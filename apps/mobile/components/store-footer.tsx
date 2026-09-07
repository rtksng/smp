import { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import { Linking, Pressable, Text, View, useWindowDimensions } from "react-native";
import { fonts } from "@/lib/theme";

type HomeSection = "categories" | "bulk";
type FooterLink = { href: Href; label: string; section?: HomeSection };

const footerLinkGroups: { title: string; links: FooterLink[] }[] = [
  {
    title: "Shop",
    links: [
      { href: "/search", label: "All products" },
      {
        href: { pathname: "/", params: { section: "categories" } },
        label: "Categories",
        section: "categories"
      },
      { href: "/brands", label: "Brands" },
      {
        href: { pathname: "/", params: { section: "bulk" } },
        label: "Bulk quote",
        section: "bulk"
      }
    ]
  },
  {
    title: "Support",
    links: [
      { href: "/orders", label: "Orders" },
      { href: "/account/quotes", label: "Quotes" },
      { href: "/addresses", label: "Saved addresses" },
      { href: "/cart", label: "Cart" }
    ]
  }
];

const procurementItems = [
  "GST-ready invoices",
  "Verified catalog",
  "Secure checkout",
  "Bulk order support"
];

export function StoreFooter({
  onSectionPress
}: {
  onSectionPress?: (section: HomeSection) => void;
}) {
  const { width } = useWindowDimensions();
  const [contactError, setContactError] = useState<string | null>(null);
  const columns = width >= 640;

  async function openContact(url: string) {
    setContactError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setContactError(
        "Unable to open the contact app. Please use the phone number or email shown above."
      );
    }
  }

  return (
    <View
      testID="store-footer"
      style={{
        backgroundColor: "#0D4440",
        borderTopColor: "#C4E4E0",
        borderTopWidth: 1,
        minHeight: 384,
        paddingHorizontal: 16,
        paddingTop: 48,
        paddingBottom: 40
      }}
    >
      <View style={{ gap: 36 }}>
        <View style={{ gap: 20 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.12)",
                borderRadius: 20,
                height: 40,
                justifyContent: "center",
                width: 40
              }}
            >
              <MaterialCommunityIcons
                color="white"
                name="shield-check-outline"
                size={20}
              />
            </View>
            <Text
              selectable
              style={{
                color: "white",
                flex: 1,
                fontFamily: fonts.bodySemiBold,
                fontSize: 16
              }}
            >
              Surgical Medical Equipment
            </Text>
          </View>
          <Text
            selectable
            style={{
              color: "rgba(255,255,255,0.72)",
              fontFamily: fonts.body,
              fontSize: 14,
              lineHeight: 24,
              marginTop: 16
            }}
          >
            Genuine surgical supplies with clear checkout and GST-ready invoices.
          </Text>
          <View style={{ flexDirection: columns ? "row" : "column", gap: 12 }}>
            {[
              {
                label: "+91 90000 00000",
                url: "tel:+919000000000",
                icon: "phone-outline" as const
              },
              {
                label: "support@surgical.example",
                url: "mailto:support@surgical.example",
                icon: "email-outline" as const
              }
            ].map((contact) => (
              <Pressable
                key={contact.url}
                accessibilityRole="link"
                onPress={() => void openContact(contact.url)}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: pressed
                    ? "rgba(255,255,255,0.16)"
                    : "rgba(255,255,255,0.1)",
                  borderRadius: 999,
                  flex: columns ? 1 : undefined,
                  flexDirection: "row",
                  gap: 8,
                  justifyContent: "center",
                  minHeight: 44,
                  paddingHorizontal: 16,
                  paddingVertical: 10
                })}
              >
                <MaterialCommunityIcons
                  color="rgba(255,255,255,0.76)"
                  name={contact.icon}
                  size={16}
                />
                <Text
                  style={{
                    color: "rgba(255,255,255,0.76)",
                    flexShrink: 1,
                    fontFamily: fonts.body,
                    fontSize: 14
                  }}
                >
                  {contact.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {contactError ? (
            <Text
              accessibilityRole="alert"
              selectable
              style={{
                color: "white",
                fontFamily: fonts.body,
                fontSize: 13,
                lineHeight: 20
              }}
            >
              {contactError}
            </Text>
          ) : null}
        </View>

        <View
          accessibilityLabel="Footer navigation"
          style={{ flexDirection: columns ? "row" : "column", gap: 28 }}
        >
          {footerLinkGroups.map((group) => (
            <View key={group.title} style={{ flex: columns ? 1 : undefined, gap: 12 }}>
              <FooterHeading>{group.title}</FooterHeading>
              <View>
                {group.links.map((link) => {
                  const content = (
                    <Pressable
                      accessibilityRole="link"
                      onPress={
                        link.section && onSectionPress
                          ? () => onSectionPress(link.section!)
                          : undefined
                      }
                      style={{
                        alignSelf: "flex-start",
                        justifyContent: "center",
                        minHeight: 44
                      }}
                    >
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.72)",
                          fontFamily: fonts.bodySemiBold,
                          fontSize: 14
                        }}
                      >
                        {link.label}
                      </Text>
                    </Pressable>
                  );
                  return link.section && onSectionPress ? (
                    <View key={link.label}>{content}</View>
                  ) : (
                    <Link asChild href={link.href} key={link.label}>
                      {content}
                    </Link>
                  );
                })}
              </View>
            </View>
          ))}
          <View style={{ flex: columns ? 1 : undefined, gap: 12 }}>
            <FooterHeading>Procurement</FooterHeading>
            <View style={{ gap: 10 }}>
              {procurementItems.map((item) => (
                <Text
                  key={item}
                  selectable
                  style={{
                    color: "rgba(255,255,255,0.72)",
                    fontFamily: fonts.bodySemiBold,
                    fontSize: 14,
                    lineHeight: 20
                  }}
                >
                  {item}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </View>
      <View
        style={{
          borderTopColor: "rgba(255,255,255,0.15)",
          borderTopWidth: 1,
          marginTop: 40,
          paddingTop: 20
        }}
      >
        <Text
          selectable
          style={{
            color: "rgba(255,255,255,0.55)",
            fontFamily: fonts.bodySemiBold,
            fontSize: 12,
            lineHeight: 18
          }}
        >
          Customer catalog, account, quote, and checkout support in one place.
        </Text>
      </View>
    </View>
  );
}

function FooterHeading({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: "white",
        fontFamily: fonts.bodySemiBold,
        fontSize: 14,
        letterSpacing: 1.12,
        textTransform: "uppercase"
      }}
    >
      {children}
    </Text>
  );
}
