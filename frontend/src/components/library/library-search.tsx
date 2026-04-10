import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type LibrarySearchProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
};

export function LibrarySearch({ value, onChange, onClear }: LibrarySearchProps) {
  return (
    <Card>
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">
            Buscar na biblioteca
          </p>
          <p className="text-sm leading-6 text-secondary">
            A busca filtra localmente os jogos carregados pelo profile atual.
          </p>
        </div>

        <label className="block">
          <span className="sr-only">Buscar jogo</span>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={value}
              placeholder="Ex.: Counter-Strike 2"
              className="h-11 w-full rounded-control border border-border bg-background-secondary px-control-x text-sm text-primary transition focus:border-accent-cyan focus:outline-none focus:ring-2 focus:ring-accent-cyan/30"
              onChange={(event) => {
                onChange(event.target.value);
              }}
            />
            <Button
              variant="secondary"
              size="md"
              disabled={value.trim().length === 0}
              onClick={onClear}
            >
              Limpar busca
            </Button>
          </div>
        </label>
      </div>
    </Card>
  );
}
