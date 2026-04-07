import { Card } from '@/components/ui/card';

type LibrarySearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function LibrarySearch({ value, onChange }: LibrarySearchProps) {
  return (
    <Card>
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.35em] text-secondary">
          Buscar jogo
        </span>
        <input
          type="search"
          value={value}
          placeholder="Ex.: Counter-Strike 2"
          className="h-11 w-full rounded-control border border-border bg-background-secondary px-control-x text-sm text-primary transition focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-accent-cyan/30"
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      </label>
    </Card>
  );
}
