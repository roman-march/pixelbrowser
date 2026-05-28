import type { FormEvent } from "react";

type UrlNavigationFormProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function UrlNavigationForm({
  value,
  onChange,
  onSubmit,
}: UrlNavigationFormProps) {
  return (
    <form className="url-form" onSubmit={onSubmit}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
      />
    </form>
  );
}
