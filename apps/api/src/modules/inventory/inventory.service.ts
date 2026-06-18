import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import {
  OrderStatus,
  Prisma,
  ProductStatus,
  StockMovementType,
  WarehouseStatus
} from "../../generated/prisma/client";
import { ApiQueueService } from "../../queues/api-queue.service";
import type {
  SendLowStockAlertJobData,
  SendNearExpiryAlertJobData
} from "@surgical/types";
import type { AuthJwtPayload } from "../auth/common/auth-token.service";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import { WarehouseAccessService } from "../warehouses/warehouse-access.service";
import { ReturnStockDisposition } from "./dto/inventory.dto";
import type {
  AdjustStockDto,
  InventoryListQueryDto,
  NearExpiryQueryDto,
  ReturnDispositionDto,
  StockInDto,
  StockMovementQueryDto,
  TransferStockDto
} from "./dto/inventory.dto";

type DecimalValue =
  | number
  | string
  | { toNumber?: () => number; toString: () => string };
type InventoryStockRecord = {
  availableQuantity: number;
  id: string;
  productId: string;
  reorderLevel: number;
  reservedQuantity: number;
  variantId: string | null;
  warehouseId: string;
};
type StockBatchRecord = {
  batchNumber: string;
  expiryDate: Date | null;
  id: string;
  mrp: DecimalValue;
  productId: string;
  purchasePrice: DecimalValue;
  quantity: number;
  sellingPrice: DecimalValue;
  variantId: string | null;
  warehouseId: string;
};
type StockMovementRecord = {
  id: string;
  productId: string;
  quantity: number;
  type: StockMovementType;
  variantId: string | null;
  warehouseId: string;
};
type PendingInventoryAlerts = {
  lowStock: SendLowStockAlertJobData[];
  nearExpiry: SendNearExpiryAlertJobData[];
};

const NEAR_EXPIRY_ALERT_WINDOW_DAYS = 30;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseAccessService: WarehouseAccessService,
    @Optional() private readonly queueService?: ApiQueueService
  ) {}

  async stockIn(input: StockInDto, context: AdminActionContext) {
    await this.warehouseAccessService.assertCanManageWarehouse(
      context.auth,
      input.warehouseId
    );

    const result = await this.prisma.$transaction(async (tx) => {
      await this.assertActiveWarehouse(tx, input.warehouseId);
      const product = await this.assertProductAndVariant(
        tx,
        input.productId,
        input.variantId ?? null
      );
      const beforeStock = await this.findInventoryStock(tx, {
        productId: input.productId,
        variantId: input.variantId ?? null,
        warehouseId: input.warehouseId
      });
      const beforeBatch = await this.findStockBatch(tx, {
        batchNumber: input.batchNumber,
        productId: input.productId,
        variantId: input.variantId ?? null,
        warehouseId: input.warehouseId
      });
      const updatedStock = await this.incrementInventoryStock(tx, {
        delta: input.quantity,
        lowStockThreshold: input.lowStockThreshold,
        productId: input.productId,
        variantId: input.variantId ?? null,
        warehouseId: input.warehouseId
      });
      const updatedBatch = beforeBatch
        ? await tx.stockBatch.update({
            data: {
              expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
              mrp: input.mrp,
              purchasePrice: input.purchasePrice,
              quantity: {
                increment: input.quantity
              },
              sellingPrice: input.sellingPrice
            },
            where: {
              id: beforeBatch.id
            }
          })
        : await tx.stockBatch.create({
            data: {
              batchNumber: input.batchNumber,
              expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
              mrp: input.mrp,
              productId: input.productId,
              purchasePrice: input.purchasePrice,
              quantity: input.quantity,
              sellingPrice: input.sellingPrice,
              variantId: input.variantId ?? null,
              warehouseId: input.warehouseId
            }
          });

      await this.publishProductWhenStocked(tx, product, updatedStock);

      await tx.stockMovement.create({
        data: {
          createdById: context.auth.sub,
          metadata: toJsonValue({
            batchNumber: input.batchNumber
          }),
          notes: input.notes,
          productId: input.productId,
          quantity: input.quantity,
          referenceType: "STOCK_IN",
          stockBatchId: updatedBatch.id,
          type: StockMovementType.IN,
          variantId: input.variantId ?? null,
          warehouseId: input.warehouseId
        }
      });
      await this.writeAuditLog(tx, context, {
        action: "inventory.stock_in",
        after: {
          batch: updatedBatch,
          stock: updatedStock
        },
        before: {
          batch: beforeBatch,
          stock: beforeStock
        },
        entityId: updatedStock.id
      });

      return {
        alerts: {
          lowStock: this.buildLowStockAlerts(updatedStock),
          nearExpiry: this.buildNearExpiryAlerts(updatedBatch)
        },
        stock: updatedStock
      };
    });

    await this.enqueueInventoryAlerts(result.alerts);

    return this.serializeStock(result.stock);
  }

  async adjustStock(input: AdjustStockDto, context: AdminActionContext) {
    await this.warehouseAccessService.assertCanManageWarehouse(
      context.auth,
      input.warehouseId
    );

    const result = await this.prisma.$transaction(async (tx) => {
      await this.assertActiveWarehouse(tx, input.warehouseId);
      await this.assertProductAndVariant(tx, input.productId, input.variantId ?? null);
      const beforeStock = await this.findInventoryStock(tx, {
        productId: input.productId,
        variantId: input.variantId ?? null,
        warehouseId: input.warehouseId
      });

      if (!beforeStock && input.quantityDelta < 0) {
        throw new BadRequestException("Stock cannot become negative.");
      }
      if (beforeStock && beforeStock.availableQuantity + input.quantityDelta < 0) {
        throw new BadRequestException("Stock cannot become negative.");
      }

      let batchId: string | null = null;
      let beforeBatch: StockBatchRecord | null = null;
      let afterBatch: StockBatchRecord | null = null;

      if (input.batchNumber !== undefined) {
        beforeBatch = await this.findStockBatch(tx, {
          batchNumber: input.batchNumber,
          productId: input.productId,
          variantId: input.variantId ?? null,
          warehouseId: input.warehouseId
        });

        if (!beforeBatch) {
          throw new NotFoundException("Stock batch was not found.");
        }
        if (beforeBatch.quantity + input.quantityDelta < 0) {
          throw new BadRequestException("Batch quantity cannot become negative.");
        }

        afterBatch = await tx.stockBatch.update({
          data: {
            quantity: {
              increment: input.quantityDelta
            }
          },
          where: {
            id: beforeBatch.id
          }
        });
        batchId = afterBatch.id;
      }

      const updatedStock = await this.incrementInventoryStock(tx, {
        delta: input.quantityDelta,
        lowStockThreshold: input.lowStockThreshold,
        productId: input.productId,
        variantId: input.variantId ?? null,
        warehouseId: input.warehouseId
      });

      await tx.stockMovement.create({
        data: {
          createdById: context.auth.sub,
          metadata: toJsonValue({
            batchNumber: input.batchNumber
          }),
          notes: input.reason,
          productId: input.productId,
          quantity: input.quantityDelta,
          referenceType: "STOCK_ADJUSTMENT",
          stockBatchId: batchId,
          type: StockMovementType.ADJUSTMENT,
          variantId: input.variantId ?? null,
          warehouseId: input.warehouseId
        }
      });
      await this.writeAuditLog(tx, context, {
        action: "inventory.adjust",
        after: {
          batch: afterBatch,
          stock: updatedStock
        },
        before: {
          batch: beforeBatch,
          stock: beforeStock
        },
        entityId: updatedStock.id
      });

      return {
        alerts: {
          lowStock: this.buildLowStockAlerts(updatedStock),
          nearExpiry: afterBatch ? this.buildNearExpiryAlerts(afterBatch) : []
        },
        stock: updatedStock
      };
    });

    await this.enqueueInventoryAlerts(result.alerts);

    return this.serializeStock(result.stock);
  }

  async transferStock(input: TransferStockDto, context: AdminActionContext) {
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new BadRequestException("Source and destination warehouses must differ.");
    }

    await this.warehouseAccessService.assertCanManageWarehouse(
      context.auth,
      input.fromWarehouseId
    );
    await this.warehouseAccessService.assertCanManageWarehouse(
      context.auth,
      input.toWarehouseId
    );

    const transferId = randomUUID();

    const result = await this.prisma.$transaction(async (tx) => {
      await this.assertActiveWarehouse(tx, input.fromWarehouseId);
      await this.assertActiveWarehouse(tx, input.toWarehouseId);
      await this.assertProductAndVariant(tx, input.productId, input.variantId ?? null);
      const sourceBefore = await this.findInventoryStock(tx, {
        productId: input.productId,
        variantId: input.variantId ?? null,
        warehouseId: input.fromWarehouseId
      });

      if (!sourceBefore || sourceBefore.availableQuantity < input.quantity) {
        throw new BadRequestException("Source warehouse does not have enough stock.");
      }

      const destinationBefore = await this.findInventoryStock(tx, {
        productId: input.productId,
        variantId: input.variantId ?? null,
        warehouseId: input.toWarehouseId
      });
      const sourceAfter = await this.incrementInventoryStock(tx, {
        delta: -input.quantity,
        productId: input.productId,
        variantId: input.variantId ?? null,
        warehouseId: input.fromWarehouseId
      });
      const destinationAfter = await this.incrementInventoryStock(tx, {
        delta: input.quantity,
        productId: input.productId,
        variantId: input.variantId ?? null,
        warehouseId: input.toWarehouseId
      });
      const batchTransfer = await this.transferBatchIfNeeded(tx, input);

      await tx.stockMovement.create({
        data: {
          createdById: context.auth.sub,
          metadata: toJsonValue({
            batchNumber: input.batchNumber,
            destinationWarehouseId: input.toWarehouseId,
            sourceWarehouseId: input.fromWarehouseId
          }),
          notes: input.notes,
          productId: input.productId,
          quantity: input.quantity,
          referenceId: transferId,
          referenceType: "STOCK_TRANSFER",
          stockBatchId: batchTransfer.sourceBatchId,
          type: StockMovementType.OUT,
          variantId: input.variantId ?? null,
          warehouseId: input.fromWarehouseId
        }
      });
      await tx.stockMovement.create({
        data: {
          createdById: context.auth.sub,
          metadata: toJsonValue({
            batchNumber: input.batchNumber,
            destinationWarehouseId: input.toWarehouseId,
            sourceWarehouseId: input.fromWarehouseId
          }),
          notes: input.notes,
          productId: input.productId,
          quantity: input.quantity,
          referenceId: transferId,
          referenceType: "STOCK_TRANSFER",
          stockBatchId: batchTransfer.destinationBatchId,
          type: StockMovementType.IN,
          variantId: input.variantId ?? null,
          warehouseId: input.toWarehouseId
        }
      });
      await this.writeAuditLog(tx, context, {
        action: "inventory.transfer",
        after: {
          destinationStock: destinationAfter,
          sourceStock: sourceAfter,
          transferId
        },
        before: {
          destinationStock: destinationBefore,
          sourceStock: sourceBefore
        },
        entityId: transferId
      });

      return {
        alerts: {
          lowStock: [
            ...this.buildLowStockAlerts(sourceAfter),
            ...this.buildLowStockAlerts(destinationAfter)
          ],
          nearExpiry: []
        },
        response: {
          destination: this.serializeStock(destinationAfter),
          source: this.serializeStock(sourceAfter),
          transferId
        }
      };
    });

    await this.enqueueInventoryAlerts(result.alerts);

    return result.response;
  }

  async dispositionReturnedItems(
    input: ReturnDispositionDto,
    context: AdminActionContext
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        include: {
          items: true
        },
        where: {
          deletedAt: null,
          id: input.orderId
        }
      });

      if (!order) {
        throw new NotFoundException("Returned order was not found.");
      }

      if (order.status !== OrderStatus.RETURNED) {
        throw new BadRequestException("Only returned orders can be dispositioned.");
      }

      const inputItemIds = new Set<string>();
      for (const item of input.items) {
        if (inputItemIds.has(item.orderItemId)) {
          throw new BadRequestException("Return disposition item is duplicated.");
        }
        inputItemIds.add(item.orderItemId);
      }

      const orderItemsById = new Map(order.items.map((item) => [item.id, item]));
      const dispositionLines = input.items.map((item) => {
        const orderItem = orderItemsById.get(item.orderItemId);

        if (!orderItem) {
          throw new BadRequestException(
            "Return disposition item is not in this order."
          );
        }
        if (!orderItem.warehouseId) {
          throw new BadRequestException("Returned item is not linked to a warehouse.");
        }

        return {
          input: item,
          orderItem
        };
      });
      const warehouseIds = [
        ...new Set(
          dispositionLines.map(({ orderItem }) => orderItem.warehouseId as string)
        )
      ];

      for (const warehouseId of warehouseIds) {
        await this.warehouseAccessService.assertCanManageWarehouse(
          context.auth,
          warehouseId
        );
        await this.assertActiveWarehouse(tx, warehouseId);
      }

      const existingMovements = await tx.stockMovement.findMany({
        where: {
          referenceId: {
            in: [...inputItemIds]
          },
          referenceType: "RETURN_DISPOSITION"
        }
      });
      const disposedQuantityByItemId = new Map<string, number>();

      for (const movement of existingMovements) {
        if (!movement.referenceId) {
          continue;
        }
        disposedQuantityByItemId.set(
          movement.referenceId,
          (disposedQuantityByItemId.get(movement.referenceId) ?? 0) + movement.quantity
        );
      }

      const responseItems = [];
      const auditBefore = dispositionLines.map(({ orderItem }) => ({
        disposedQuantity: disposedQuantityByItemId.get(orderItem.id) ?? 0,
        orderItemId: orderItem.id,
        orderedQuantity: orderItem.quantity
      }));

      for (const { input: line, orderItem } of dispositionLines) {
        const warehouseId = orderItem.warehouseId;
        const alreadyDisposed = disposedQuantityByItemId.get(orderItem.id) ?? 0;

        if (!warehouseId) {
          throw new BadRequestException("Returned item is not linked to a warehouse.");
        }

        if (!orderItem.productId) {
          throw new BadRequestException(
            "Returned custom quote item is not linked to inventory."
          );
        }

        if (alreadyDisposed + line.quantity > orderItem.quantity) {
          throw new BadRequestException(
            "Return disposition quantity exceeds the remaining returned quantity."
          );
        }

        let restocked = false;
        let stockAfter: InventoryStockRecord | null = null;
        let batchAfter: StockBatchRecord | null = null;

        if (line.disposition === ReturnStockDisposition.RESTOCK) {
          if (!orderItem.stockBatchId) {
            throw new BadRequestException(
              "Returned item is not linked to a stock batch."
            );
          }

          const product = await this.assertProductAndVariant(
            tx,
            orderItem.productId,
            orderItem.variantId
          );
          const stockBatch = await tx.stockBatch.findFirst({
            where: {
              id: orderItem.stockBatchId,
              productId: orderItem.productId,
              variantId: orderItem.variantId,
              warehouseId
            }
          });

          if (!stockBatch) {
            throw new NotFoundException("Original stock batch was not found.");
          }

          stockAfter = await this.incrementInventoryStock(tx, {
            delta: line.quantity,
            productId: orderItem.productId,
            variantId: orderItem.variantId,
            warehouseId
          });
          batchAfter = await tx.stockBatch.update({
            data: {
              quantity: {
                increment: line.quantity
              }
            },
            where: {
              id: stockBatch.id
            }
          });
          await this.publishProductWhenStocked(tx, product, stockAfter);
          restocked = true;
        }

        const movement = await tx.stockMovement.create({
          data: {
            createdById: context.auth.sub,
            metadata: toJsonValue({
              disposition: line.disposition,
              orderId: order.id,
              orderItemId: orderItem.id,
              orderNumber: order.orderNumber,
              stockBatchId: orderItem.stockBatchId
            }),
            notes: line.note ?? input.note,
            productId: orderItem.productId,
            quantity: line.quantity,
            referenceId: orderItem.id,
            referenceType: "RETURN_DISPOSITION",
            stockBatchId: orderItem.stockBatchId,
            type: StockMovementType.RETURN,
            variantId: orderItem.variantId,
            warehouseId
          }
        });

        responseItems.push({
          disposition: line.disposition,
          movementId: movement.id,
          orderItemId: orderItem.id,
          quantity: line.quantity,
          restocked,
          stock: stockAfter ? this.serializeStock(stockAfter) : null,
          stockBatch: batchAfter ? this.serializeBatch(batchAfter) : null
        });
      }

      await this.writeAuditLog(tx, context, {
        action: "inventory.return_disposition",
        after: {
          items: responseItems,
          note: input.note,
          orderId: order.id,
          orderNumber: order.orderNumber
        },
        before: {
          items: auditBefore
        },
        entityId: order.id
      });

      return {
        items: responseItems,
        orderId: order.id,
        orderNumber: order.orderNumber
      };
    });

    return result;
  }

  async listInventory(query: InventoryListQueryDto, auth: AuthJwtPayload) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = await this.buildInventoryWhere(query, auth);
    const [items, total] = await Promise.all([
      this.prisma.inventoryStock.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        where
      }),
      this.prisma.inventoryStock.count({
        where
      })
    ]);

    return paginated(
      items.map((item) => this.serializeStock(item)),
      total,
      page,
      limit
    );
  }

  async listLowStock(query: InventoryListQueryDto, auth: AuthJwtPayload) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = await this.buildInventoryWhere(query, auth);
    const items = await this.prisma.inventoryStock.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      where
    });
    const lowStockItems = items.filter(
      (item) => item.availableQuantity <= item.reorderLevel
    );

    return paginated(
      lowStockItems
        .slice((page - 1) * limit, page * limit)
        .map((item) => this.serializeStock(item)),
      lowStockItems.length,
      page,
      limit
    );
  }

  async listNearExpiry(query: NearExpiryQueryDto, auth: AuthJwtPayload) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const warehouseWhere = await this.buildScopedWarehouseFilter(
      query.warehouseId,
      auth
    );
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + (query.days ?? 30));
    const where: Prisma.StockBatchWhereInput = {
      expiryDate: {
        gte: now,
        lte: cutoff
      },
      productId: query.productId,
      quantity: {
        gt: 0
      },
      warehouseId: warehouseWhere
    };
    const [items, total] = await Promise.all([
      this.prisma.stockBatch.findMany({
        orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        where
      }),
      this.prisma.stockBatch.count({
        where
      })
    ]);

    return paginated(
      items.map((item) => this.serializeBatch(item)),
      total,
      page,
      limit
    );
  }

  async listMovements(query: StockMovementQueryDto, auth: AuthJwtPayload) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const warehouseWhere = await this.buildScopedWarehouseFilter(
      query.warehouseId,
      auth
    );
    const where: Prisma.StockMovementWhereInput = {
      productId: query.productId,
      type: query.type,
      warehouseId: warehouseWhere
    };
    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        where
      }),
      this.prisma.stockMovement.count({
        where
      })
    ]);

    return paginated(
      items.map((item) => this.serializeMovement(item)),
      total,
      page,
      limit
    );
  }

  private async transferBatchIfNeeded(
    tx: Prisma.TransactionClient,
    input: TransferStockDto
  ) {
    if (input.batchNumber === undefined) {
      return {
        destinationBatchId: null,
        sourceBatchId: null
      };
    }

    const sourceBatch = await this.findStockBatch(tx, {
      batchNumber: input.batchNumber,
      productId: input.productId,
      variantId: input.variantId ?? null,
      warehouseId: input.fromWarehouseId
    });

    if (!sourceBatch) {
      throw new NotFoundException("Source stock batch was not found.");
    }
    if (sourceBatch.quantity < input.quantity) {
      throw new BadRequestException("Source batch does not have enough stock.");
    }

    const updatedSourceBatch = await tx.stockBatch.update({
      data: {
        quantity: {
          increment: -input.quantity
        }
      },
      where: {
        id: sourceBatch.id
      }
    });
    const existingDestinationBatch = await this.findStockBatch(tx, {
      batchNumber: input.batchNumber,
      productId: input.productId,
      variantId: input.variantId ?? null,
      warehouseId: input.toWarehouseId
    });
    const destinationBatch = existingDestinationBatch
      ? await tx.stockBatch.update({
          data: {
            quantity: {
              increment: input.quantity
            }
          },
          where: {
            id: existingDestinationBatch.id
          }
        })
      : await tx.stockBatch.create({
          data: {
            batchNumber: sourceBatch.batchNumber,
            expiryDate: sourceBatch.expiryDate,
            mrp: sourceBatch.mrp,
            productId: input.productId,
            purchasePrice: sourceBatch.purchasePrice,
            quantity: input.quantity,
            sellingPrice: sourceBatch.sellingPrice,
            variantId: input.variantId ?? null,
            warehouseId: input.toWarehouseId
          }
        });

    return {
      destinationBatchId: destinationBatch.id,
      sourceBatchId: updatedSourceBatch.id
    };
  }

  private async buildInventoryWhere(
    query: InventoryListQueryDto,
    auth: AuthJwtPayload
  ): Promise<Prisma.InventoryStockWhereInput> {
    const where: Prisma.InventoryStockWhereInput = {
      productId: query.productId,
      warehouseId: await this.buildScopedWarehouseFilter(query.warehouseId, auth)
    };

    if (query.search !== undefined && query.search.trim().length > 0) {
      const search = query.search.trim();
      where.OR = [
        {
          product: {
            name: {
              contains: search,
              mode: "insensitive"
            }
          }
        },
        {
          product: {
            sku: {
              contains: search,
              mode: "insensitive"
            }
          }
        }
      ];
    }

    return stripUndefined(where);
  }

  private async buildScopedWarehouseFilter(
    warehouseId: string | undefined,
    auth: AuthJwtPayload
  ) {
    if (warehouseId !== undefined) {
      await this.warehouseAccessService.assertCanManageWarehouse(auth, warehouseId);
      return warehouseId;
    }

    const scope = await this.warehouseAccessService.getWarehouseScope(auth);

    return scope.allWarehouses
      ? undefined
      : {
          in: scope.warehouseIds
        };
  }

  private async assertActiveWarehouse(
    tx: Prisma.TransactionClient,
    warehouseId: string
  ) {
    const warehouse = await tx.warehouse.findFirst({
      where: {
        deletedAt: null,
        id: warehouseId,
        status: WarehouseStatus.ACTIVE
      }
    });

    if (!warehouse) {
      throw new NotFoundException("Active warehouse was not found.");
    }
  }

  private async assertProductAndVariant(
    tx: Prisma.TransactionClient,
    productId: string,
    variantId: string | null
  ) {
    const product = await tx.product.findFirst({
      where: {
        deletedAt: null,
        id: productId
      }
    });

    if (!product) {
      throw new NotFoundException("Product was not found.");
    }

    if (variantId === null) {
      return product;
    }

    const variant = await tx.productVariant.findFirst({
      where: {
        deletedAt: null,
        id: variantId,
        productId
      }
    });

    if (!variant) {
      throw new NotFoundException("Product variant was not found.");
    }

    return product;
  }

  private async publishProductWhenStocked(
    tx: Prisma.TransactionClient,
    product: { id: string; status: ProductStatus },
    stock: InventoryStockRecord
  ) {
    if (
      stock.availableQuantity <= 0 ||
      (product.status !== ProductStatus.DRAFT &&
        product.status !== ProductStatus.OUT_OF_STOCK)
    ) {
      return;
    }

    await tx.product.update({
      data: {
        status: ProductStatus.ACTIVE
      },
      where: {
        id: product.id
      }
    });
  }

  private findInventoryStock(
    tx: Prisma.TransactionClient,
    input: {
      productId: string;
      variantId: string | null;
      warehouseId: string;
    }
  ) {
    return tx.inventoryStock.findFirst({
      where: {
        productId: input.productId,
        variantId: input.variantId,
        warehouseId: input.warehouseId
      }
    });
  }

  private findStockBatch(
    tx: Prisma.TransactionClient,
    input: {
      batchNumber: string;
      productId: string;
      variantId: string | null;
      warehouseId: string;
    }
  ) {
    return tx.stockBatch.findFirst({
      where: {
        batchNumber: input.batchNumber,
        productId: input.productId,
        variantId: input.variantId,
        warehouseId: input.warehouseId
      }
    });
  }

  private async incrementInventoryStock(
    tx: Prisma.TransactionClient,
    input: {
      delta: number;
      lowStockThreshold?: number;
      productId: string;
      variantId: string | null;
      warehouseId: string;
    }
  ) {
    const existingStock = await this.findInventoryStock(tx, input);

    if (!existingStock) {
      if (input.delta < 0) {
        throw new BadRequestException("Stock cannot become negative.");
      }

      return tx.inventoryStock.create({
        data: {
          availableQuantity: input.delta,
          productId: input.productId,
          reorderLevel: input.lowStockThreshold ?? 0,
          reservedQuantity: 0,
          variantId: input.variantId,
          warehouseId: input.warehouseId
        }
      });
    }

    if (existingStock.availableQuantity + input.delta < 0) {
      throw new BadRequestException("Stock cannot become negative.");
    }

    return tx.inventoryStock.update({
      data: {
        availableQuantity: {
          increment: input.delta
        },
        ...(input.lowStockThreshold !== undefined
          ? { reorderLevel: input.lowStockThreshold }
          : {})
      },
      where: {
        id: existingStock.id
      }
    });
  }

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    context: AdminActionContext,
    input: {
      action: string;
      after?: unknown;
      before?: unknown;
      entityId?: string;
    }
  ) {
    await tx.adminAuditLog.create({
      data: {
        action: input.action,
        adminUserId: context.auth.sub,
        after: input.after === undefined ? undefined : toJsonValue(input.after),
        before: input.before === undefined ? undefined : toJsonValue(input.before),
        entityId: input.entityId,
        entityType: "Inventory",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      }
    });
  }

  private buildLowStockAlerts(stock: InventoryStockRecord): SendLowStockAlertJobData[] {
    if (stock.availableQuantity > stock.reorderLevel) {
      return [];
    }

    return [
      {
        availableQuantity: stock.availableQuantity,
        productId: stock.productId,
        reorderLevel: stock.reorderLevel,
        requestedAt: new Date().toISOString(),
        variantId: stock.variantId,
        version: 1,
        warehouseId: stock.warehouseId
      }
    ];
  }

  private buildNearExpiryAlerts(batch: StockBatchRecord): SendNearExpiryAlertJobData[] {
    if (!batch.expiryDate || !isNearExpiry(batch.expiryDate)) {
      return [];
    }

    return [
      {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate.toISOString(),
        productId: batch.productId,
        quantity: batch.quantity,
        requestedAt: new Date().toISOString(),
        variantId: batch.variantId,
        version: 1,
        warehouseId: batch.warehouseId
      }
    ];
  }

  private async enqueueInventoryAlerts(alerts: PendingInventoryAlerts) {
    for (const alert of alerts.lowStock) {
      await this.queueService?.enqueueLowStockAlert(alert);
    }

    for (const alert of alerts.nearExpiry) {
      await this.queueService?.enqueueNearExpiryAlert(alert);
    }
  }

  private serializeStock(stock: InventoryStockRecord) {
    return {
      availableQuantity: stock.availableQuantity,
      id: stock.id,
      lowStockThreshold: stock.reorderLevel,
      productId: stock.productId,
      reservedQuantity: stock.reservedQuantity,
      variantId: stock.variantId,
      warehouseId: stock.warehouseId
    };
  }

  private serializeBatch(batch: StockBatchRecord) {
    return {
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      id: batch.id,
      mrp: decimalToNumber(batch.mrp),
      productId: batch.productId,
      purchasePrice: decimalToNumber(batch.purchasePrice),
      quantity: batch.quantity,
      sellingPrice: decimalToNumber(batch.sellingPrice),
      variantId: batch.variantId,
      warehouseId: batch.warehouseId
    };
  }

  private serializeMovement(movement: StockMovementRecord) {
    return {
      id: movement.id,
      productId: movement.productId,
      quantity: movement.quantity,
      type: movement.type,
      variantId: movement.variantId,
      warehouseId: movement.warehouseId
    };
  }
}

function decimalToNumber(value: DecimalValue) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(value.toString());
}

function isNearExpiry(expiryDate: Date) {
  const now = Date.now();
  const cutoff = now + NEAR_EXPIRY_ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const expiryTime = expiryDate.getTime();

  return expiryTime >= now && expiryTime <= cutoff;
}

function paginated<T>(items: T[], total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit);

  return {
    items,
    pagination: {
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      limit,
      page,
      total,
      totalPages
    }
  };
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
