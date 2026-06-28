import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { FieldError } from "heroui-native/field-error";
import { Input } from "heroui-native/input";
import { Label } from "heroui-native/label";
import { TextField } from "heroui-native/text-field";

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
        isInvalid={isInvalid}
        placeholderTextColor="#94A3B8"
        selectionColor="#287C30"
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
    fontSize: 12,
    fontWeight: "700"
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CBD5E1",
    borderRadius: 8,
    borderWidth: 1,
    color: "#0F172A",
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 12
  },
  inputInvalid: {
    borderColor: "#B91C1C"
  },
  label: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800"
  },
  textArea: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: "top"
  }
});
