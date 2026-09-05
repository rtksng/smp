"use client";

import {
  BarChart3,
  BookOpenCheck,
  Boxes,
  CheckCircle2,
  CircleAlert,
  CircleX,
  ClipboardList,
  FileText,
  FolderTree,
  HandCoins,
  Package,
  Search,
  Settings,
  ShoppingCart,
  TicketPercent,
  Truck,
  Users,
  Warehouse,
  X
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type GuideField = {
  example?: string;
  label: string;
  text: string;
};

type GuideSection = {
  doList?: string[];
  dontList?: string[];
  example?: string;
  fields?: GuideField[];
  flow?: string[];
  icon: ReactNode;
  id: string;
  important?: string;
  links?: Array<{ href: string; label: string }>;
  steps: string[];
  summary: string;
  title: string;
};

const guideSections: GuideSection[] = [
  {
    doList: [
      "Use filters before acting when you have many records.",
      "Open View or Edit to check the complete record before changing it.",
      "Use the status shown on screen as the source of truth for the next step."
    ],
    dontList: [
      "Do not change a status just to make a list look complete.",
      "Do not delete or archive a record until you have checked it is no longer needed."
    ],
    icon: <BookOpenCheck aria-hidden size={20} />,
    id: "start",
    important:
      "Your menu can look different from another employee's menu. It shows only the areas your role allows you to use.",
    links: [
      { href: "/dashboard", label: "Open dashboard" },
      { href: "/reports", label: "Open reports" }
    ],
    steps: [
      "Sign in with your own work account.",
      "Start on Dashboard to see the current order, stock, customer, warehouse, and delivery picture.",
      "Use the left menu to open the work area you need.",
      "Use Add filter or Apply filter to narrow a long list, then Reset to return to the full visible list.",
      "Use the page totals as a quick check, then open the related list or record before making a decision."
    ],
    summary: "Learn the safe daily habits that apply across the whole admin panel.",
    title: "Start here"
  },
  {
    doList: [
      "Create the parent category first, then add its child categories.",
      "Keep a category active only when it should be available for product selection."
    ],
    dontList: [
      "Do not make duplicate categories with almost the same name.",
      "Do not delete a category until products have been moved to another suitable category."
    ],
    example:
      "Example: create “Surgical Instruments” as a main category, then add “Forceps” as its child category.",
    fields: [
      { label: "Name", text: "The customer-facing category name." },
      { label: "Slug", text: "The short web-friendly name. Use lowercase words separated by hyphens.", example: "surgical-instruments" },
      { label: "Parent category", text: "Leave blank for a main category. Select a main category when creating a child category." },
      { label: "Sort order", text: "A whole number that controls the display order. Lower numbers appear earlier." },
      { label: "Description and image", text: "Optional supporting information and category image." },
      { label: "Active in catalog", text: "Keeps the category available for products and the catalog." }
    ],
    icon: <FolderTree aria-hidden size={20} />,
    id: "categories-brands",
    links: [
      { href: "/categories", label: "Open categories" },
      { href: "/brands", label: "Open brands" }
    ],
    steps: [
      "Open Categories and choose Create category.",
      "For a main category, leave Parent category empty. For a child category, choose its main category.",
      "Fill Name, Slug, Sort order, and catalog status, then save.",
      "On the main category list, use Edit in Child categories to view or edit its child categories.",
      "For Brands, use Create brand, fill Name and Slug, optionally add a description and brand image, then set its catalog status and save."
    ],
    summary: "Set up the category tree and the brands that products use.",
    title: "Categories and brands"
  },
  {
    doList: [
      "Create the brand and category before creating the product.",
      "Save new products as Draft until names, prices, images, and descriptions are checked.",
      "Use one primary image only."
    ],
    dontList: [
      "Do not set selling price or base price higher than MRP.",
      "Do not reuse a SKU for another product or variant.",
      "Do not mark a product Active before its required details are complete."
    ],
    example:
      "Example: SKU “FORCEPS-ADSON-12” can identify one specific product. Search tags can be “forceps, adson, reusable”.",
    fields: [
      { label: "Name, Slug and SKU", text: "Name is what staff and customers see. Slug is the web-friendly name. SKU is the unique item code used to identify the product." },
      { label: "Brand, Category and Subcategory", text: "Choose the existing brand and main category. The subcategory list appears after you select its main category." },
      { label: "Status", text: "Draft keeps the product off the active catalog. Active makes it available. Inactive keeps its record but removes it from active use. Out of stock signals that it cannot currently be sold." },
      { label: "Short description and Description", text: "Short description is a quick summary. Description is the full product information." },
      { label: "Base price, Selling price, MRP and Tax rate", text: "Base price is your internal product cost. Selling price is what the customer pays before tax. MRP is the maximum retail price. Tax rate is the percentage charged on the product." },
      { label: "Unit, Pack size, Material and Medical specialty", text: "Describe how the item is counted, pack contents, material, and intended medical area when relevant." },
      { label: "Expiry sensitive, Sterile and Disposable", text: "Turn on only when the product truly has that property. Expiry-sensitive products need expiry attention in stock." },
      { label: "Search tags, Meta title and Meta description", text: "Optional search wording. Separate search tags with commas." },
      { label: "Images, variants and documents", text: "Add product photos, alternate versions, and supporting files such as a certificate, compliance file, manual, or warranty." }
    ],
    flow: ["Brand and category", "Create product as Draft", "Check price and information", "Add stock", "Set Active when ready"],
    icon: <Package aria-hidden size={20} />,
    id: "products",
    important:
      "Creating a product does not add stock. Add stock separately in Inventory after the product is saved.",
    links: [
      { href: "/products/create", label: "Create product" },
      { href: "/products", label: "Open products" }
    ],
    steps: [
      "Open Products and choose Create product.",
      "Fill the core details, category, brand, product status, and both descriptions.",
      "Fill prices carefully: base price and selling price must not be more than MRP. Tax rate cannot be more than 100%.",
      "Add images, optional variants, and documents if they apply. Give each variant its own SKU and price.",
      "Save. Then open Inventory and use Stock in to add physical stock before making the product Active."
    ],
    summary: "Create and maintain products, including prices, variants, files, and catalog status.",
    title: "Products"
  },
  {
    doList: [
      "Use a short, stable warehouse code in uppercase.",
      "Keep contact and address details current so packing and delivery teams use the correct location.",
      "Set a warehouse Inactive only when it should no longer receive normal work."
    ],
    dontList: [
      "Do not create the same physical location more than once.",
      "Do not assign staff to the wrong warehouse."
    ],
    fields: [
      { label: "Name and code", text: "The warehouse name and its short uppercase code.", example: "Mumbai Central Warehouse / MUM-01" },
      { label: "Address, City, State and Pincode", text: "The full working location. Pincode must contain 6 digits." },
      { label: "Contact person and contact number", text: "The person and phone number for warehouse coordination." },
      { label: "Latitude and Longitude", text: "Optional location coordinates. Leave empty if you do not have verified values." },
      { label: "Status", text: "Active warehouses are available for normal operations. Inactive warehouses remain as records but should not be used for new work." },
      { label: "Warehouse staff", text: "Choose an existing admin user to give them a warehouse assignment. You can remove an assignment when it is no longer needed." }
    ],
    icon: <Warehouse aria-hidden size={20} />,
    id: "warehouses",
    links: [
      { href: "/warehouses", label: "Open warehouse overview" },
      { href: "/warehouses/create", label: "Create warehouse" },
      { href: "/warehouses/staff", label: "Manage warehouse staff" }
    ],
    steps: [
      "Open Warehouses to check active, inactive, visible, and state coverage totals.",
      "Use Apply filter to search by name, code, city, state, or status.",
      "Choose Create warehouse, complete the location and contact fields, choose the correct status, and save.",
      "Use Warehouse list to edit, activate, or deactivate an existing warehouse.",
      "Use Warehouse staff to select a warehouse and assign or remove eligible admin users."
    ],
    summary: "Create physical stock locations and manage who works with each one.",
    title: "Warehouses"
  },
  {
    doList: [
      "Use Stock in only when goods have physically arrived.",
      "Use a clear reason for every adjustment.",
      "Use Transfer when stock moves between two different warehouses."
    ],
    dontList: [
      "Do not use an adjustment to move stock between warehouses.",
      "Do not enter a zero quantity or transfer to the same warehouse.",
      "Do not restock a returned item until its condition is checked."
    ],
    example:
      "Example: if 5 damaged units were found, use Adjust with -5 and a reason such as “Damaged during count”.",
    fields: [
      { label: "Overview filters", text: "Search by product, choose a warehouse, or show Low stock and Near expiry results. Near expiry shows positive batches expiring soon." },
      { label: "Stock in", text: "Choose warehouse and product, optionally choose a variant, then enter batch number, optional expiry date, quantity, purchase price, selling price, MRP, low-stock threshold, and notes." },
      { label: "Adjust", text: "Choose warehouse and product, optional variant and batch, enter a positive or negative quantity change, an optional threshold, and a required reason." },
      { label: "Transfer", text: "Choose source warehouse, destination warehouse, product, optional variant and batch, quantity, and optional notes. Source and destination must differ." },
      { label: "Movements", text: "The history records stock in, stock out, adjustment, transfer, and return movements. Use it to investigate a stock number." },
      { label: "Return stock decision", text: "For an approved returned order, choose Restock for saleable stock, Quarantine for stock needing inspection, or Scrap for unusable stock."
      }
    ],
    flow: ["Product exists", "Stock in at warehouse", "Order reserves stock", "Pack and deliver", "Return decision when needed"],
    icon: <Boxes aria-hidden size={20} />,
    id: "inventory",
    important:
      "Available means stock that can still be used. Reserved means stock held for orders and not free for another sale.",
    links: [
      { href: "/inventory", label: "Open inventory overview" },
      { href: "/inventory/actions", label: "Open stock actions" },
      { href: "/inventory/movements", label: "Open movement history" }
    ],
    steps: [
      "Open Inventory Overview to check available, reserved, threshold, warning, batch, and expiry information.",
      "Choose Stock actions when stock arrives, needs correction, or must move to another warehouse.",
      "For a stock arrival, fill every price from the receiving document and set a realistic low-stock threshold.",
      "For a correction, enter the exact increase or decrease and a reason that another employee can understand.",
      "After saving, use Movements to confirm the entry appears in the history."
    ],
    summary: "Receive, correct, transfer, and review stock across warehouses.",
    title: "Inventory and stock"
  },
  {
    doList: [
      "Open the order before changing its status.",
      "Use the next status only when that stage has actually happened.",
      "Add a short note when a status change or cancellation needs context."
    ],
    dontList: [
      "Do not mark an order Packed before the items are packed.",
      "Do not cancel an order after it has moved beyond the allowed cancellation stages.",
      "Do not treat payment status as delivery status."
    ],
    fields: [
      { label: "Order filters", text: "Filter by order status, payment status, date range, customer mobile, order number, or warehouse." },
      { label: "Order status", text: "Created and Confirmed orders offer their next manual stage. Assignment and delivery statuses are recorded through the delivery workflow, while returns are handled from Returns & Refunds." },
      { label: "Payment status", text: "Pending, Authorized, Paid, Failed, Refunded, Partially refunded, or Cancelled. This describes money, not delivery progress." },
      { label: "Order detail", text: "Shows items, customer and delivery address, linked warehouse, payment information, totals, invoice, refunds, and status history." },
      { label: "Cancel reason", text: "Explain why the order is being cancelled so another employee can understand the decision." }
    ],
    flow: ["Created", "Confirmed", "Packed", "Assigned", "Out for delivery", "Delivered"],
    icon: <ShoppingCart aria-hidden size={20} />,
    id: "orders",
    links: [{ href: "/orders", label: "Open orders" }],
    steps: [
      "Open Orders and use filters to find the correct order.",
      "Choose View to inspect the items, warehouse, payment, totals, addresses, and previous updates.",
      "Move Created to Confirmed only after the order is accepted.",
      "Move Confirmed to Packed only after the correct items are physically packed.",
      "Assign delivery from Delivery when the order is Confirmed or Packed. Continue through delivery only as the actual movement happens."
    ],
    summary: "Find orders, verify their details, and move them through the correct fulfilment stages.",
    title: "Orders"
  },
  {
    doList: [
      "Use View to check an account's addresses, order history, and previous support notes before acting.",
      "Write factual support notes that help the next employee."
    ],
    dontList: [
      "Do not create duplicate customer accounts from this screen.",
      "Do not block a customer without a clear business reason and note."
    ],
    fields: [
      { label: "Search and Active filter", text: "Find customers by the visible account information and narrow to active or inactive accounts." },
      { label: "Customer detail", text: "Shows contact details, business and GSTIN when present, addresses, past orders, and support notes." },
      { label: "Status", text: "Active allows normal use. Inactive keeps the account as a record. Blocked should be used only when normal account use must stop." },
      { label: "Support note", text: "An internal note for staff. Keep it short, factual, and relevant to future help." }
    ],
    icon: <Users aria-hidden size={20} />,
    id: "customers",
    links: [{ href: "/customers", label: "Open customers" }],
    steps: [
      "Search for the customer and open View.",
      "Check the contact information, addresses, and order history.",
      "Add a support note if there is important follow-up context.",
      "Change account status only when the account should be active, inactive, or blocked, then keep the note clear."
    ],
    summary: "Review customer accounts, their addresses and orders, and record useful support context.",
    title: "Customers"
  },
  {
    doList: [
      "Approve a partner only after their documents are reviewed.",
      "Assign only an Active partner to an eligible order.",
      "Use the assignment timeline to check what happened and when."
    ],
    dontList: [
      "Do not assign an offline, inactive, suspended, or pending-verification partner.",
      "Do not mark a delivery as complete without confirmation."
    ],
    fields: [
      { label: "Partner status", text: "Pending verification awaits review. Active can receive work. Inactive and Suspended cannot be used for normal delivery work." },
      { label: "Availability", text: "Online indicates the partner is currently available; Offline means they are not currently shown as available." },
      { label: "Partner detail", text: "Shows contact details, vehicle number when present, documents, wallet totals, and recent activity." },
      { label: "Assignment filters", text: "Filter assignments by delivery status, delivery partner, or warehouse." },
      { label: "Assign order", text: "Choose an eligible Confirmed or Packed order, an Active partner, an optional pickup warehouse, and optional pickup instructions." },
      { label: "Assignment status", text: "Assigned, Accepted, Picked up, Out for delivery, Delivered, Failed, or Cancelled. Use only the next stage offered by the screen." }
    ],
    flow: ["Partner approved", "Order assigned", "Accepted", "Picked up", "Out for delivery", "Delivered or failed"],
    icon: <Truck aria-hidden size={20} />,
    id: "delivery",
    links: [
      { href: "/delivery", label: "Open delivery overview" },
      { href: "/delivery/partners", label: "Open partners" },
      { href: "/delivery/assign", label: "Assign an order" }
    ],
    steps: [
      "Open Partners, filter by status, and open View to review the partner's information and documents.",
      "Approve or reject pending partner records only after review.",
      "Open Assign order and choose the order, an Active partner, and the pickup warehouse if it differs from the order warehouse.",
      "Open Assignments to follow the timeline, proof of delivery, or a reported issue.",
      "Update the assignment only as it moves through its real delivery stages."
    ],
    summary: "Review delivery partners, assign eligible orders, and track delivery progress.",
    title: "Delivery"
  },
  {
    doList: [
      "Check the order, refund reason, payment, and returned items before approving.",
      "Use a stock decision for every eligible returned item after it is physically checked."
    ],
    dontList: [
      "Do not restock an item that is damaged, opened when it cannot be resold, or needs inspection.",
      "Do not approve or reject without a clear internal note when the decision needs explanation."
    ],
    fields: [
      { label: "Filters", text: "Find requests by refund status, customer mobile, order number, or warehouse." },
      { label: "Refund status", text: "Pending, Processing, Completed, Failed, or Cancelled. Use Process/refetch only when the refund needs processing or a status refresh." },
      { label: "Internal note", text: "A staff-only reason for an approval or rejection." },
      { label: "Stock disposition", text: "Restock returns saleable units to stock. Quarantine separates units for inspection. Scrap marks unusable units as not fit for sale." },
      { label: "Quantity", text: "Choose the returned order item and enter no more than the quantity that was ordered." }
    ],
    flow: ["Request received", "Check order and item", "Approve or reject", "Choose stock decision", "Process refund"],
    icon: <HandCoins aria-hidden size={20} />,
    id: "returns-refunds",
    links: [{ href: "/returns-refunds/requests", label: "Open returns and refunds" }],
    steps: [
      "Open Returns & Refunds and filter to find the request.",
      "Open the order if you need to verify the item, delivery, payment, or history.",
      "Write an internal note, then approve or reject according to the actual request and item condition.",
      "Once the order is Returned, choose the item, quantity, stock decision, and optional condition note.",
      "Use Process/refetch to process or check the refund outcome."
    ],
    summary: "Make careful return, refund, and returned-stock decisions.",
    title: "Returns and refunds"
  },
  {
    doList: [
      "Use a clear code customers can enter correctly.",
      "Set a maximum discount for percentage offers when you need a cap.",
      "Set a start and end date when the offer must run only for a fixed period."
    ],
    dontList: [
      "Do not set the expiry earlier than the start date.",
      "Do not use a zero or negative discount value.",
      "Do not archive a coupon still needed by an active campaign."
    ],
    example:
      "Example: code “SURGICAL10”, type Percentage, value 10, minimum order amount 1000, maximum discount 300.",
    fields: [
      { label: "Code", text: "The customer enters this at checkout. It is saved in uppercase." },
      { label: "Type and value", text: "Percentage gives a percent discount. Fixed amount gives a rupee discount. Value must be above zero." },
      { label: "Minimum order amount", text: "Optional minimum basket value required before the coupon can be used." },
      { label: "Maximum discount", text: "Optional cap for a percentage discount." },
      { label: "Usage limit", text: "Optional total number of uses. Enter a whole number above zero." },
      { label: "Start, expiry and Active", text: "Optional dates control the offer window. Active turns the coupon on for use." }
    ],
    icon: <TicketPercent aria-hidden size={20} />,
    id: "coupons",
    links: [{ href: "/coupons", label: "Open coupons" }, { href: "/coupons/new", label: "Create coupon" }],
    steps: [
      "Open Coupons and choose Create coupon.",
      "Choose percentage or fixed amount and enter the matching discount value.",
      "Add any order minimum, maximum discount, usage limit, and date window.",
      "Keep the coupon Active only when it should work at checkout.",
      "Use the list search, Edit, or Archive to maintain existing coupons."
    ],
    summary: "Create and control checkout discount coupons.",
    title: "Coupons"
  },
  {
    doList: [
      "Give each rule a clear name and check its range and location before activating it.",
      "Use priority carefully when more than one rule could apply."
    ],
    dontList: [
      "Do not enter a six-digit pincode incorrectly.",
      "Do not make the maximum order amount lower than the minimum order amount."
    ],
    example:
      "Example: “Mumbai standard” can charge ₹80 for PIN 400001 orders from ₹0 to ₹2,000, with free delivery at ₹3,000.",
    fields: [
      { label: "Rule name and Active", text: "A clear internal name and the switch that turns the rule on or off." },
      { label: "Delivery charge", text: "The amount added for delivery. It can be zero." },
      { label: "Pincode and warehouse", text: "Optional scope. Leave blank to cover all pincodes or all warehouses visible to the rule." },
      { label: "Minimum and maximum order amount", text: "Optional order-value range for when the rule applies." },
      { label: "Free delivery threshold", text: "Optional order value at which delivery becomes free." },
      { label: "Priority", text: "A whole-number ordering used when rules overlap. Agree the order with your operations lead before changing it." }
    ],
    icon: <Truck aria-hidden size={20} />,
    id: "delivery-charges",
    links: [{ href: "/delivery-charges/rules", label: "Open delivery charges" }, { href: "/delivery-charges/new", label: "Create charge rule" }],
    steps: [
      "Open Delivery Charges and choose Create rule.",
      "Enter the rule name, charge, optional location scope, order-value range, free threshold, priority, and status.",
      "Check that the range and priority do not conflict with another active rule.",
      "Save, then use the rule list and filters to review, edit, deactivate, or archive rules."
    ],
    summary: "Set delivery fees by location, warehouse, order value, and priority.",
    title: "Delivery charges"
  },
  {
    doList: [
      "Read the customer's message and use the selected product details when quoting an existing item.",
      "Set a valid-until date when the price should expire."
    ],
    dontList: [
      "Do not send a quotation without at least one priced line.",
      "Do not mark a request as converted unless the customer decision has actually completed that step."
    ],
    fields: [
      { label: "Status", text: "New, Contacted, Quoted, Accepted, Rejected, Converted, or Closed. Choose the state that reflects the real customer conversation." },
      { label: "Quotation line", text: "Enter item SKU, item name, quantity, unit price, and tax rate. You can link a product and variant when applicable." },
      { label: "Shipping and valid until", text: "Enter an optional shipping amount and the last date the customer can use the quoted price." },
      { label: "Notes", text: "Customer-facing quote notes, such as availability or delivery information." }
    ],
    flow: ["New enquiry", "Contact customer", "Prepare quotation", "Customer accepts or rejects", "Convert or close"],
    icon: <FileText aria-hidden size={20} />,
    id: "quote-requests",
    links: [{ href: "/quote-requests", label: "Open quote requests" }],
    steps: [
      "Open Quote Requests and filter by status if needed.",
      "Open the customer request and read their message and contact information.",
      "Set the correct conversation status, then add one or more quotation lines.",
      "Enter shipping, a valid-until date, and notes when needed. Check the calculated subtotal, tax, shipping, and total.",
      "Send or update the quotation, then update the status as the customer responds."
    ],
    summary: "Turn customer enquiries into clear, accurate quotations.",
    title: "Quote requests"
  },
  {
    doList: [
      "Publish helpful, genuine reviews and answers that are ready for customers to read.",
      "Use a moderation note when a review or question needs a staff explanation."
    ],
    dontList: [
      "Do not publish abusive, irrelevant, or unsafe content.",
      "Do not hide a question before checking whether it needs a helpful answer."
    ],
    fields: [
      { label: "Reviews", text: "Shows customer rating, title, comment, status, moderation note, and created date." },
      { label: "Questions", text: "Shows the question and lets an authorised admin write and save an answer." },
      { label: "Filters", text: "Filter reviews or questions by product reference and status." },
      { label: "Moderation", text: "The screen offers the relevant action, such as publish, reject, or hide. Use a short moderation note when needed." }
    ],
    icon: <ClipboardList aria-hidden size={20} />,
    id: "product-feedback",
    links: [{ href: "/product-feedback", label: "Open product feedback" }],
    steps: [
      "Open Product Feedback, then choose Reviews or Questions.",
      "Use the product reference and status filters to find the item.",
      "For a review, check the rating and comment, add a moderation note if helpful, then choose the appropriate action.",
      "For a question, write a clear answer and save it before publishing or hiding the item as appropriate."
    ],
    summary: "Moderate customer reviews and answer product questions.",
    title: "Product feedback"
  },
  {
    doList: [
      "Set a date range before comparing performance.",
      "Use a drilldown link to inspect the record behind a chart or number.",
      "Export only the report you have reviewed."
    ],
    dontList: [
      "Do not compare different date ranges as though they represent the same period.",
      "Do not assume a chart replaces checking the detailed list."
    ],
    fields: [
      { label: "Dashboard totals", text: "Shows current orders, revenue, stock alerts, customers, warehouses, and active delivery partners." },
      { label: "Report filters", text: "Set date range, warehouse, order status, payment status, and near-expiry days to match the question you are investigating." },
      { label: "Sales and Orders", text: "Shows orders and revenue by day." },
      { label: "Products", text: "Shows top-selling products by quantity and revenue." },
      { label: "Inventory and Warehouses", text: "Shows low-stock and near-expiry alerts, available and reserved stock, batches, and warehouse totals." },
      { label: "Export", text: "Downloads the current report in CSV or PDF form when the page offers export." }
    ],
    icon: <BarChart3 aria-hidden size={20} />,
    id: "dashboard-reports",
    links: [{ href: "/dashboard", label: "Open dashboard" }, { href: "/reports", label: "Open reports" }],
    steps: [
      "Start on Dashboard for the current operational picture.",
      "Open Reports and choose Sales, Orders, Products, Inventory, or Warehouses based on the question.",
      "Set filters first, then read the charts and tables together.",
      "Use Drilldown to open the related order, customer, product, inventory, or warehouse view.",
      "Export only after confirming the filter values and date range."
    ],
    summary: "Use the dashboard and reports to find trends, stock risks, and the records behind them.",
    title: "Dashboard and reports"
  },
  {
    doList: [
      "Give each admin the least access they need for their job.",
      "Set an employee Inactive or Suspended promptly when their access should stop.",
      "Check the role and permission lists before giving a user a role."
    ],
    dontList: [
      "Do not share one admin account between employees.",
      "Do not delete your own active account from the user list."
    ],
    fields: [
      { label: "Admin user", text: "First name, optional last name, work email, optional mobile number, role, account status, and password for a new user." },
      { label: "New password", text: "Optional while editing. Leave it empty when the existing password should stay unchanged." },
      { label: "Role", text: "The work role that decides which sections and actions the user can access." },
      { label: "Status", text: "Active allows access. Inactive keeps the account as a record without normal use. Suspended blocks use until reviewed." },
      { label: "Role", text: "Review the predefined role descriptions and access before assigning one to an admin account."
      }
    ],
    icon: <Settings aria-hidden size={20} />,
    id: "settings",
    links: [{ href: "/settings/admin-users", label: "Manage admin users" }, { href: "/settings/roles", label: "View roles" }],
    steps: [
      "Open Settings to manage admin users.",
      "Search by name, email, mobile, role, or status when updating an existing account.",
      "For a new employee, enter their name, email, role, status, and a password of at least 8 characters.",
      "For an existing employee, update only the details that changed; leave New password empty unless you mean to replace it.",
      "Use the Roles page to review access, then assign a predefined role from the Role dropdown."
    ],
    summary: "Manage employee admin accounts and understand the access given by each role.",
    title: "Settings and access"
  },
  {
    doList: ["Read a status before taking the next action."],
    dontList: ["Do not use a status as a substitute for checking the real-world work."],
    fields: [
      { label: "Product", text: "Draft = still being prepared; Active = available; Inactive = kept as a record but not active; Out of stock = cannot currently be sold." },
      { label: "Stock movement", text: "In = received; Out = removed; Adjustment = counted correction; Transfer = moved between warehouses; Return = handled from a customer return." },
      { label: "Order", text: "Created, Confirmed, Packed, Assigned, Out for delivery, Delivered, Cancelled, Returned." },
      { label: "Payment and refund", text: "Payment: Pending, Authorized, Paid, Failed, Refunded, Partially refunded, Cancelled. Refund: Pending, Processing, Completed, Failed, Cancelled." },
      { label: "Delivery", text: "Partner: Pending verification, Active, Inactive, Suspended. Assignment: Assigned, Accepted, Picked up, Out for delivery, Delivered, Failed, Cancelled." },
      { label: "Customer, warehouse and admin user", text: "Customer: Active, Inactive, Blocked. Warehouse: Active, Inactive. Admin user: Active, Inactive, Suspended." },
      { label: "Quote request and product feedback", text: "Quote: New, Contacted, Quoted, Accepted, Rejected, Converted, Closed. Feedback uses the relevant review or question actions, including pending, answered, published, rejected, or hidden." }
    ],
    icon: <CircleAlert aria-hidden size={20} />,
    id: "status-guide",
    important: "If a status name is unclear, open the related record and read its history before changing it.",
    steps: [
      "Find the record in its normal list.",
      "Check the current status, history, and real-world evidence.",
      "Choose only an allowed next action shown by the screen.",
      "Add a concise note when the decision needs explanation."
    ],
    summary: "A plain-language reference for the statuses you will see across the panel.",
    title: "Status guide"
  }
];

export function AdminGuide() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSections = useMemo(
    () =>
      guideSections.filter((section) => {
        if (!normalizedQuery) {
          return true;
        }

        return getSectionSearchText(section).includes(normalizedQuery);
      }),
    [normalizedQuery]
  );

  return (
    <section className="adminGuidePage">
      <PageHeader eyebrow="Operations manual" title="Admin Guide" />
      <div className="adminGuideLead">
        <div>
          <strong>Everything you need for day-to-day admin work.</strong>
          <p>
            Start with the section you need, follow the listed steps, and use the
            Important, Do, and Don&apos;t notes before making a change.
          </p>
        </div>
        <label className="adminGuideSearch">
          <span className="srOnly">Search the admin guide</span>
          <Search aria-hidden size={18} />
          <Input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products, stock, orders, refunds..."
            value={query}
          />
          {query ? (
            <Button
              aria-label="Clear guide search"
              className="iconOnlyButton adminGuideClearSearch"
              onClick={() => setQuery("")}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden size={16} />
            </Button>
          ) : null}
        </label>
      </div>

      <div className="adminGuideLayout">
        <aside className="adminGuideToc" aria-label="Admin guide contents">
          <span className="adminGuideTocLabel">On this page</span>
          <nav>
            {visibleSections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        <div className="adminGuideContent">
          <section className="adminGuideQuickStart" aria-label="Common workflows">
            <GuideShortcut href="#products" icon={<Package aria-hidden size={18} />} label="Create a product" />
            <GuideShortcut href="#inventory" icon={<Boxes aria-hidden size={18} />} label="Add stock" />
            <GuideShortcut href="#orders" icon={<ShoppingCart aria-hidden size={18} />} label="Process an order" />
            <GuideShortcut href="#returns-refunds" icon={<HandCoins aria-hidden size={18} />} label="Handle a return" />
          </section>

          {normalizedQuery ? (
            <p className="adminGuideSearchResult" aria-live="polite">
              {visibleSections.length} matching section{visibleSections.length === 1 ? "" : "s"}
            </p>
          ) : null}

          {visibleSections.length > 0 ? (
            visibleSections.map((section) => <GuideSectionCard key={section.id} section={section} />)
          ) : (
            <div className="emptyPanel adminGuideEmpty">
              <CircleX aria-hidden size={22} />
              <strong>No guide section matches that search.</strong>
              <p>Try a word such as product, warehouse, stock, order, delivery, refund, coupon, or user.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function GuideSectionCard({ section }: { section: GuideSection }) {
  return (
    <section className="adminGuideSection" id={section.id}>
      <div className="adminGuideSectionHeading">
        <span className="adminGuideSectionIcon">{section.icon}</span>
        <div>
          <h2>{section.title}</h2>
          <p>{section.summary}</p>
        </div>
      </div>

      {section.links?.length ? (
        <div className="adminGuideLinks">
          {section.links.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}

      {section.important ? <GuideCallout tone="important">{section.important}</GuideCallout> : null}
      {section.flow ? <GuideFlow steps={section.flow} title={`${section.title} flow`} /> : null}

      <div className="adminGuideSteps">
        <h3>How to do it</h3>
        <ol>
          {section.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      {section.fields?.length ? (
        <div className="adminGuideFields">
          <h3>Fields and controls</h3>
          <dl>
            {section.fields.map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>
                  {field.text}
                  {field.example ? <em>Example: {field.example}</em> : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {section.example ? <GuideCallout tone="example">{section.example}</GuideCallout> : null}

      {section.doList?.length || section.dontList?.length ? (
        <div className="adminGuideAdvice">
          {section.doList?.length ? (
            <GuideAdvice icon={<CheckCircle2 aria-hidden size={17} />} title="Do" values={section.doList} />
          ) : null}
          {section.dontList?.length ? (
            <GuideAdvice icon={<CircleX aria-hidden size={17} />} title="Don’t" values={section.dontList} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function GuideShortcut({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a className="adminGuideShortcut" href={href}>
      {icon}
      <span>{label}</span>
    </a>
  );
}

function GuideFlow({ steps, title }: { steps: string[]; title: string }) {
  return (
    <div className="adminGuideFlow" aria-label={title}>
      {steps.map((step, index) => (
        <div className="adminGuideFlowStep" key={step}>
          <span>{index + 1}</span>
          <strong>{step}</strong>
        </div>
      ))}
    </div>
  );
}

function GuideCallout({ children, tone }: { children: ReactNode; tone: "example" | "important" }) {
  return (
    <aside className="adminGuideCallout" data-tone={tone}>
      <strong>{tone === "important" ? "Important" : "Example"}</strong>
      <p>{children}</p>
    </aside>
  );
}

function GuideAdvice({ icon, title, values }: { icon: ReactNode; title: string; values: string[] }) {
  return (
    <div className="adminGuideAdviceColumn" data-tone={title === "Do" ? "do" : "dont"}>
      <h3>
        {icon}
        <span>{title}</span>
      </h3>
      <ul>
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  );
}

function getSectionSearchText(section: GuideSection) {
  return [
    section.title,
    section.summary,
    section.important,
    section.example,
    ...section.steps,
    ...(section.fields?.flatMap((field) => [field.label, field.text, field.example]) ?? []),
    ...(section.doList ?? []),
    ...(section.dontList ?? [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
