const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarBRL = (valor: number) => brl.format(valor);

export const formatarHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "1-5, 8, 10" → ["1","2","3","4","5","8","10"]. Faixa até 300 mesas. */
export function expandirMesas(texto: string): string[] {
  const mesas: string[] = [];
  for (const parte of texto.split(/[,;\s]+/).filter(Boolean)) {
    const faixa = /^(\d+)-(\d+)$/.exec(parte);
    if (faixa) {
      const [ini, fim] = [Number(faixa[1]), Number(faixa[2])].sort((a, b) => a - b);
      for (let n = ini!; n <= fim! && mesas.length < 300; n++) mesas.push(String(n));
    } else {
      mesas.push(parte);
    }
  }
  return [...new Set(mesas)];
}
