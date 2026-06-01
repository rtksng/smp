import sanitizeHtml from "sanitize-html";

const textAlignValues = [/^left$/, /^right$/, /^center$/, /^justify$/];

export function sanitizeProductDescriptionHtml(description: string) {
  return sanitizeHtml(description, {
    allowedAttributes: {
      "*": ["style"],
      a: ["href", "rel", "target"]
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedStyles: {
      "*": {
        "text-align": textAlignValues
      }
    },
    allowedTags: [
      "a",
      "b",
      "br",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "i",
      "li",
      "ol",
      "p",
      "strong",
      "u",
      "ul"
    ],
    transformTags: {
      a: (_tagName, attribs) => {
        const linkAttributes: Record<string, string> = {};

        if (attribs.href) {
          linkAttributes.href = attribs.href;
          linkAttributes.rel = "noopener noreferrer";
          linkAttributes.target = "_blank";
        }

        return {
          attribs: linkAttributes,
          tagName: "a"
        };
      }
    }
  }).trim();
}
