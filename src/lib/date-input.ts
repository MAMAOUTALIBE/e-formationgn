// Conversion Date -> valeur d'un <input type="date"> (AAAA-MM-JJ).
//
// Vit dans `lib/` et non dans le composant d'état civil : ce dernier est un
// module "use client", et une fonction simple qui en est exportée ne peut pas
// être appelée depuis un Server Component — Next lève alors
// « Attempted to call … from the server ».
export function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}
