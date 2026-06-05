export type Field = {
  name: string;
  label: string;
  placeholder?: string;
  default?: string;
  type?: "text" | "textarea" | "number";
};

export type Preset = {
  id: string;
  service: string;
  label: string;
  description?: string;
  fields: Field[];
  code: (params: Record<string, string>) => string;
  run: (params: Record<string, string>) => Promise<unknown>;
};
