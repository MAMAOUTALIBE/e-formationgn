// Analyse d'une liste d'élèves collée ou importée depuis un tableur.
//
// Écrit à la main plutôt qu'avec une bibliothèque : le besoin est étroit
// (3 à 4 colonnes) mais les fichiers réels sont sales. Un export Excel
// français utilise le point-virgule, ajoute un BOM UTF-8 en tête et des fins
// de ligne CRLF ; les copier-coller depuis Google Sheets arrivent en
// tabulations. Tout cela est géré ici.

export interface ParsedStudentRow {
  /** Numéro de ligne dans le fichier d'origine, pour situer une erreur. */
  line: number;
  /** Nom complet tel qu'il sera affiché et imprimé. */
  fullName: string;
  email: string;
  birthDate: string;
  birthPlace: string;
  gender: string;
  phone: string;
  country: string;
  address: string;
}

export interface CsvParseResult {
  rows: ParsedStudentRow[];
  /** Lignes rejetées, avec la raison — affichées telles quelles à l'admin. */
  errors: Array<{ line: number; reason: string }>;
}

/** Nombre maximal de lignes traitées en une fois — voir le commentaire d'import. */
export const MAX_IMPORT_ROWS = 50;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Détecte le séparateur d'après la première ligne non vide. */
function detectDelimiter(sample: string): string {
  const counts = [
    { d: ";", n: (sample.match(/;/g) ?? []).length },
    { d: "\t", n: (sample.match(/\t/g) ?? []).length },
    { d: ",", n: (sample.match(/,/g) ?? []).length },
  ];
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ";";
}

/** Découpe une ligne en respectant les champs entre guillemets. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Guillemet doublé à l'intérieur d'un champ cité = guillemet littéral.
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((c) => c.trim());
}

/** Retire accents, ponctuation et casse pour comparer des intitulés humains. */
function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Intitulés reconnus, par champ. Plusieurs formulations par colonne : le
 * fichier vient d'un client, pas d'un gabarit qu'on lui aurait imposé.
 */
const HEADER_ALIASES: Record<string, readonly string[]> = {
  // « Nom » seul appartient à `lastName`, jamais à `fullName` : dans un
  // fichier qui porte « Prénom » et « Nom » côte à côte — la forme la plus
  // répandue — le rattacher au nom complet faisait disparaître le prénom.
  // Une colonne « Nom » esseulée reste bien reprise, puisque le nom complet
  // se recompose de ce qui a été trouvé.
  fullName: ["nometprenom", "nomcomplet", "nomprenom", "prenomnom", "identite"],
  firstName: ["prenom", "firstname"],
  lastName: ["nom", "nomdefamille", "lastname"],
  email: ["email", "mail", "courriel", "adresseemail", "adresseelectronique"],
  birthDate: ["datedenaissance", "naissance", "ddn", "birthdate"],
  birthPlace: ["lieudenaissance", "villedenaissance", "birthplace"],
  gender: ["sexe", "genre", "gender"],
  phone: ["telephone", "tel", "portable", "phone", "mobile"],
  country: ["pays", "country"],
  address: ["adresse", "adressepostale", "address"],
  role: ["role", "profil", "fonction"],
};

/**
 * Associe chaque champ à son index de colonne d'après la ligne d'en-tête.
 *
 * Sans en-tête on garde la lecture par position — prénom, nom, email — qui
 * est ce que les fichiers existants contiennent. Avec en-tête, l'ordre des
 * colonnes cesse de compter et les colonnes surnuméraires sont ignorées :
 * c'est ce qui permet de réimporter un export de la plateforme sans le
 * retailler à la main.
 */
function mapHeader(cells: string[]): Record<string, number> | null {
  const mapping: Record<string, number> = {};
  cells.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (mapping[field] === undefined && aliases.includes(normalized)) {
        mapping[field] = index;
        return;
      }
    }
  });
  // Sans email identifiable, l'en-tête ne nous apprend rien d'exploitable.
  return mapping.email === undefined ? null : mapping;
}

/**
 * Analyse le contenu collé.
 *
 * Deux formes acceptées : une ligne d'en-tête nommée — l'ordre des colonnes
 * ne compte alors plus — ou, à défaut, l'ordre historique prénom / nom /
 * email. Les comptes internes sont créés depuis « Équipe & accès », jamais
 * depuis un import d'apprenants.
 */
export function parseStudentCsv(raw: string): CsvParseResult {
  const rows: ParsedStudentRow[] = [];
  const errors: CsvParseResult["errors"] = [];

  // Retire le BOM UTF-8 qu'Excel place en tête, sinon le premier champ
  // commence par un caractère invisible et le prénom est corrompu.
  const text = raw.replace(/^\ufeff/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");

  const firstContent = lines.find((l) => l.trim() !== "") ?? "";
  const delimiter = detectDelimiter(firstContent);

  const seen = new Set<string>();
  let headerSkipped = false;
  let header: Record<string, number> | null = null;

  const INTERNAL_ROLE =
    /formateur|instructor|admin|gestionnaire|manager|support|finance|moderateur|modérateur/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;

    const cells = splitLine(line, delimiter);

    // Une ligne n'est un en-tête que si elle NOMME ses colonnes. Le test
    // précédent — « aucune cellule ne ressemble à un email » — avalait la
    // première ligne de données dès que son adresse comportait une faute :
    // la ligne disparaissait, sans compte créé et sans erreur signalée.
    if (!headerSkipped) {
      const mapped = mapHeader(cells);
      headerSkipped = true;
      if (mapped) {
        header = mapped;
        continue;
      }
    }

    const lineNumber = i + 1;
    const at = (index: number | undefined): string =>
      index === undefined ? "" : (cells[index] ?? "");

    let fullName: string;
    let email: string;
    let roleCell: string;
    let birthDate = "";
    let birthPlace = "";
    let gender = "";
    let phone = "";
    let country = "";
    let address = "";

    if (header) {
      // Un fichier peut porter « nom et prénom » en une colonne, ou les deux
      // séparées : on recompose dans les deux cas.
      const composed = [at(header.firstName), at(header.lastName)]
        .filter(Boolean)
        .join(" ")
        .trim();
      fullName = at(header.fullName) || composed;
      email = at(header.email);
      roleCell = at(header.role);
      birthDate = at(header.birthDate);
      birthPlace = at(header.birthPlace);
      gender = at(header.gender);
      phone = at(header.phone);
      country = at(header.country);
      address = at(header.address);
    } else {
      if (cells.length < 3) {
        errors.push({
          line: lineNumber,
          reason:
            "Il faut au moins trois colonnes : prénom, nom, email — ou une ligne d'en-tête nommant les colonnes.",
        });
        continue;
      }
      fullName = [cells[0], cells[1]].filter(Boolean).join(" ").trim();
      email = cells[2] ?? "";
      roleCell = cells[3] ?? "";
    }

    const normalizedEmail = email.toLowerCase();

    if (fullName.length < 2) {
      errors.push({ line: lineNumber, reason: "Nom et prénom manquants." });
      continue;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      errors.push({ line: lineNumber, reason: `Email invalide : « ${email} ».` });
      continue;
    }
    if (roleCell && INTERNAL_ROLE.test(roleCell)) {
      errors.push({
        line: lineNumber,
        reason:
          "Un compte interne ne peut pas être importé comme apprenant. Utilisez « Équipe & accès ».",
      });
      continue;
    }
    // Doublon interne au fichier : le signaler ici évite un échec obscur de
    // contrainte d'unicité au milieu de l'import.
    if (seen.has(normalizedEmail)) {
      errors.push({
        line: lineNumber,
        reason: `Email en double dans le fichier : ${normalizedEmail}.`,
      });
      continue;
    }
    seen.add(normalizedEmail);

    rows.push({
      line: lineNumber,
      fullName,
      email: normalizedEmail,
      birthDate,
      birthPlace,
      gender,
      phone,
      country,
      address,
    });
  }

  return { rows, errors };
}
