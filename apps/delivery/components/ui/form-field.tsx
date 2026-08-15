import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { FieldError } from "heroui-native/field-error";
import { Input } from "heroui-native/input";
import { Label } from "heroui-native/label";
import { TextField } from "heroui-native/text-field";
import { fonts } from "../../lib/theme";

type FormFieldProps = ComponentProps<typeof Input> & {
  error?: string;
  label: string;
  required?: boolean;
};

export function FormField({
  error,
  label,
  required,
  style,
  ...props
}: FormFieldProps) {
  const isInvalid = Boolean(error);

  return (
    <TextField isInvalid={isInvalid} isRequired={required}>
      <Label>
        <Label.Text styles={{ text: styles.label }}>{label}</Label.Text>
      </Label>
      <Input
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityState={{
          ...props.accessibilityState,
          disabled: Boolean(props.editable === false)
        }}
        autoCorrect={props.autoCorrect ?? false}
        isInvalid={isInvalid}
        placeholderTextColor="#849C98"
        selectionColor="#0F6F68"
        style={[
          styles.input,
          props.multiline && styles.textArea,
          isInvalid && styles.inputInvalid,
          style
        ]}
        {...props}
      />
      <FieldError isInvalid={isInvalid} styles={{ text: styles.error }}>
        {error}
      </FieldError>
    </TextField>
  );
}

const styles = StyleSheet.create({
  error: {
    color: "#B91C1C",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "700"
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#C4E4E0",
    borderRadius: 8,
    borderWidth: 1,
    color: "#123432",
    fontFamily: fonts.body,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 9
  },
  inputInvalid: {
    borderColor: "#B91C1C"
  },
  label: {
    color: "#2B4946",
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: "800"
  },
  textArea: {
    minHeight: 84,
    paddingTop: 10,
    textAlignVertical: "top"
  }
});
