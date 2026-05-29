import type { FormEvent } from "react";

type UrlNavigationFormProps = {
  projectName: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function UrlNavigationForm({
  projectName,
  value,
  onChange,
  onSubmit,
}: UrlNavigationFormProps) {
  const urlParts = splitUrl(value);

  return (
    <form className="url-form" onSubmit={onSubmit}>
      <div className="url-display" aria-hidden="true">
        <span>{urlParts.primary}</span>
        <span className="url-display-muted">{urlParts.secondary}</span>
      </div>
      <input
        aria-label="URL"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
      />
      <div className="project-chip" aria-hidden="true">
        {projectLabel(projectName)}
      </div>
    </form>
  );
}

function splitUrl(value: string) {
  try {
    const url = new URL(value);
    return {
      primary: url.hostname.replace(/^www\./, ""),
      secondary: `${url.pathname}${url.search}${url.hash}`,
    };
  } catch {
    return {
      primary: value,
      secondary: "",
    };
  }
}

function projectLabel(name: string) {
  const label = name.trim();
  if (!label) {
    return "AIXII";
  }

  const words = label.split(/\s+/);
  if (words.length > 1) {
    return words.map((word) => word[0]).join("").slice(0, 5).toUpperCase();
  }

  return label.slice(0, 10).toUpperCase();
}
