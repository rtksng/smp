import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Button } from "@/components/ui/button";
import type { Brand, Category } from "@/lib/api/schemas";
import type { ProductQuery } from "@/lib/api/catalog";
import { colors, fonts } from "@/lib/theme";

export type CatalogFilters = {
  availability: boolean;
  brand?: string;
  category?: string;
  disposable: boolean;
  expirySensitive: boolean;
  maxPrice: string;
  medicalSpecialty: string;
  minPrice: string;
  search: string;
  sort: NonNullable<ProductQuery["sort"]>;
  sterile: boolean;
  stock: "all" | "in_stock" | "out_of_stock";
  subcategory?: string;
};

export const defaultCatalogFilters: CatalogFilters = {
  availability: false,
  disposable: false,
  expirySensitive: false,
  maxPrice: "",
  medicalSpecialty: "",
  minPrice: "",
  search: "",
  sort: "latest",
  sterile: false,
  stock: "all"
};

export function CatalogFilterSheet({
  brands,
  categories,
  filters,
  lockedBrand,
  onApply,
  onClose,
  visible
}: {
  brands: Brand[];
  categories: Category[];
  filters: CatalogFilters;
  lockedBrand?: string;
  onApply: (filters: CatalogFilters) => void;
  onClose: () => void;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (visible) {
      setDraft(filters);
    }
  }, [filters, visible]);

  const subcategories = useMemo(() => {
    if (draft.category) {
      return (
        categories.find((category) => category.slug === draft.category)
          ?.children ?? []
      );
    }

    return categories.flatMap((category) => category.children);
  }, [categories, draft.category]);

  function patch(next: Partial<CatalogFilters>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Pressable
          accessibilityLabel="Close filters"
          accessibilityRole="button"
          onPress={onClose}
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.42)",
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0
          }}
        />
        <View
          accessibilityLabel="Product filters"
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.surface,
            borderCurve: "continuous",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "90%",
            paddingBottom: Math.max(insets.bottom, 12)
          }}
        >
          <View
            style={{
              alignItems: "center",
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
              flexDirection: "row",
              gap: 10,
              minHeight: 64,
              paddingHorizontal: 16
            }}
          >
            <Feather color={colors.text} name="sliders" size={19} />
            <Text
              selectable
              style={{
                color: colors.ink,
                flex: 1,
                fontFamily: fonts.headingBold,
                fontSize: 17
              }}
            >
              Filters and sort
            </Text>
            <Pressable
              accessibilityLabel="Clear filters"
              accessibilityRole="button"
              onPress={() => setDraft({ ...defaultCatalogFilters, brand: lockedBrand })}
              style={({ pressed }) => ({
                alignItems: "center",
                borderColor: colors.border,
                borderRadius: 999,
                borderWidth: 1,
                justifyContent: "center",
                minHeight: 40,
                opacity: pressed ? 0.72 : 1,
                paddingHorizontal: 12
              })}
            >
              <Text
                style={{
                  color: colors.primaryDark,
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 12
                }}
              >
                Clear
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Close filters"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => ({
                alignItems: "center",
                borderColor: colors.border,
                borderRadius: 12,
                borderWidth: 1,
                height: 40,
                justifyContent: "center",
                opacity: pressed ? 0.72 : 1,
                width: 40
              })}
            >
              <Feather color={colors.text} name="x" size={19} />
            </Pressable>
          </View>

          <KeyboardAwareScrollView
            bottomOffset={96}
            contentContainerStyle={{ gap: 18, padding: 16 }}
            contentInsetAdjustmentBehavior="automatic"
            keyboardDismissMode={
              process.env.EXPO_OS === "ios" ? "interactive" : "on-drag"
            }
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            <FilterTextField
              label="Search query"
              onChangeText={(search) => patch({ search })}
              placeholder="Product, SKU, brand, specialty"
              value={draft.search}
            />

            <ChoiceField
              label="Category"
              onChange={(category) =>
                patch({ category: category || undefined, subcategory: undefined })
              }
              options={[
                { label: "All categories", value: "" },
                ...categories.map((category) => ({
                  label: category.name,
                  value: category.slug
                }))
              ]}
              value={draft.category ?? ""}
            />

            <ChoiceField
              label="Subcategory"
              onChange={(subcategory) =>
                patch({ subcategory: subcategory || undefined })
              }
              options={[
                { label: "All subcategories", value: "" },
                ...subcategories.filter((subcategory) => subcategory.isActive).map((subcategory) => ({
                  label: subcategory.name,
                  value: subcategory.slug
                }))
              ]}
              value={draft.subcategory ?? ""}
            />

            {lockedBrand ? (
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>Brand</Text>
                <Text selectable style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>
                  {brands.find((brand) => brand.slug === lockedBrand)?.name ?? lockedBrand}
                </Text>
              </View>
            ) : <ChoiceField
              label="Brand"
              onChange={(brand) => patch({ brand: brand || undefined })}
              options={[
                { label: "All brands", value: "" },
                ...brands.map((brand) => ({
                  label: brand.name,
                  value: brand.slug
                }))
              ]}
              value={draft.brand ?? ""}
            />}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FilterTextField
                  keyboardType="decimal-pad"
                  label="Min price"
                  onChangeText={(minPrice) => patch({ minPrice })}
                  placeholder="0"
                  value={draft.minPrice}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FilterTextField
                  keyboardType="decimal-pad"
                  label="Max price"
                  onChangeText={(maxPrice) => patch({ maxPrice })}
                  placeholder="5000"
                  value={draft.maxPrice}
                />
              </View>
            </View>

            <DirectChoiceField
              label="Stock status"
              onChange={(stock) =>
                patch({
                  stock: stock as CatalogFilters["stock"]
                })
              }
              options={[
                { label: "Any stock status", value: "all" },
                { label: "In stock", value: "in_stock" },
                { label: "Out of stock", value: "out_of_stock" }
              ]}
              value={draft.stock}
            />

            <FilterTextField
              label="Clinical specialty"
              onChangeText={(medicalSpecialty) => patch({ medicalSpecialty })}
              placeholder="General Surgery, ICU, OT"
              value={draft.medicalSpecialty}
            />

            <View style={{ gap: 8 }}>
              <CheckRow
                checked={draft.availability}
                label="Only available products"
                onPress={() => patch({ availability: !draft.availability })}
              />
              <CheckRow
                checked={draft.expirySensitive}
                label="Expiry sensitive"
                onPress={() =>
                  patch({ expirySensitive: !draft.expirySensitive })
                }
              />
              <CheckRow
                checked={draft.sterile}
                label="Sterile"
                onPress={() => patch({ sterile: !draft.sterile })}
              />
              <CheckRow
                checked={draft.disposable}
                label="Disposable"
                onPress={() => patch({ disposable: !draft.disposable })}
              />
            </View>

            <DirectChoiceField
              label="Sort"
              onChange={(sort) =>
                patch({ sort: sort as CatalogFilters["sort"] })
              }
              options={[
                { label: "Latest", value: "latest" },
                { label: "Price low to high", value: "price_low_to_high" },
                { label: "Price high to low", value: "price_high_to_low" },
                { label: "Name A-Z", value: "name_az" }
              ]}
              value={draft.sort}
            />
          </KeyboardAwareScrollView>

          <View
            style={{
              borderTopColor: colors.border,
              borderTopWidth: 1,
              paddingHorizontal: 16,
              paddingTop: 12
            }}
          >
            <Button
              accessibilityLabel="Apply filters"
              onPress={() => onApply(normalizePrices({ ...draft, brand: lockedBrand ?? draft.brand }))}
            >
              Apply Filters
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FilterTextField({
  keyboardType,
  label,
  onChangeText,
  placeholder,
  value
}: {
  keyboardType?: "decimal-pad";
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={{ gap: 7 }}>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={{
          backgroundColor: colors.surface,
          borderColor: "#9FD7D1",
          borderCurve: "continuous",
          borderRadius: 12,
          borderWidth: 1,
          color: colors.text,
          fontFamily: fonts.body,
          fontSize: 15,
          minHeight: 48,
          paddingHorizontal: 14
        }}
        value={value}
      />
    </View>
  );
}

function ChoiceField({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  return (
    <View style={{ gap: 7 }}>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        accessibilityLabel={`${label}: ${selectedOption?.label ?? "Select"}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: colors.surface,
          borderColor: "#9FD7D1",
          borderCurve: "continuous",
          borderRadius: 12,
          borderWidth: 1,
          flexDirection: "row",
          gap: 10,
          minHeight: 48,
          opacity: pressed ? 0.78 : 1,
          paddingHorizontal: 14
        })}
      >
        <Text
          numberOfLines={1}
          style={{
            color: colors.text,
            flex: 1,
            fontFamily: fonts.body,
            fontSize: 15
          }}
        >
          {selectedOption?.label ?? "Select"}
        </Text>
        <Feather
          color={colors.text}
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
        />
      </Pressable>
      {open ? (
        <View
          accessibilityLabel={`${label} options`}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: 12,
            borderWidth: 1,
            maxHeight: 224,
            overflow: "hidden"
          }}
        >
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
            {options.map((option, index) => {
              const selected = option.value === value;

              return (
                <Pressable
                  accessibilityLabel={`${label}: ${option.label}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={`${label}-${option.value || "all"}`}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: selected
                      ? colors.primarySoft
                      : pressed
                        ? colors.surfaceMuted
                        : colors.surface,
                    borderBottomColor: colors.border,
                    borderBottomWidth: index === options.length - 1 ? 0 : 1,
                    flexDirection: "row",
                    gap: 10,
                    minHeight: 46,
                    paddingHorizontal: 14
                  })}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: selected ? colors.primaryDark : colors.text,
                      flex: 1,
                      fontFamily: selected
                        ? fonts.bodySemiBold
                        : fonts.body,
                      fontSize: 14
                    }}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <Feather
                      color={colors.primaryDark}
                      name="check"
                      size={17}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function DirectChoiceField({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  const threeColumnLayout = options.length <= 3;

  return (
    <View style={{ gap: 7 }}>
      <FieldLabel>{label}</FieldLabel>
      <View
        accessibilityLabel={`${label} options`}
        accessibilityRole="radiogroup"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
      >
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={`${label}-${option.value}`}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: selected
                  ? colors.primaryDark
                  : colors.surfaceMuted,
                borderColor: selected ? colors.primaryDark : colors.border,
                borderCurve: "continuous",
                borderRadius: 999,
                borderWidth: 1,
                flexBasis: threeColumnLayout ? "30%" : "47%",
                flexGrow: 1,
                justifyContent: "center",
                minHeight: 42,
                opacity: pressed ? 0.78 : 1,
                paddingHorizontal: 10,
                paddingVertical: 8
              })}
            >
              <Text
                numberOfLines={2}
                style={{
                  color: selected ? colors.surface : colors.text,
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 12,
                  lineHeight: 16,
                  textAlign: "center"
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CheckRow({
  checked,
  label,
  onPress
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderCurve: "continuous",
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: "row",
        gap: 12,
        minHeight: 48,
        opacity: pressed ? 0.78 : 1,
        paddingHorizontal: 14
      })}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: checked ? colors.primaryDark : colors.surface,
          borderColor: checked ? colors.primaryDark : "#9FD7D1",
          borderRadius: 5,
          borderWidth: 1,
          height: 22,
          justifyContent: "center",
          width: 22
        }}
      >
        {checked ? (
          <Feather color={colors.surface} name="check" size={15} />
        ) : null}
      </View>
      <Text
        selectable
        style={{
          color: colors.text,
          flex: 1,
          fontFamily: fonts.bodySemiBold,
          fontSize: 13
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text
      selectable
      style={{
        color: colors.text,
        fontFamily: fonts.bodySemiBold,
        fontSize: 13
      }}
    >
      {children}
    </Text>
  );
}

function normalizePrices(filters: CatalogFilters) {
  const minimum = readPrice(filters.minPrice);
  const maximum = readPrice(filters.maxPrice);

  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    return {
      ...filters,
      maxPrice: String(minimum),
      minPrice: String(maximum)
    };
  }

  return {
    ...filters,
    maxPrice: maximum === undefined ? "" : String(maximum),
    minPrice: minimum === undefined ? "" : String(minimum)
  };
}

export function readPrice(value: string) {
  const parsed = Number(value.trim());

  return value.trim() && Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : undefined;
}
