import { parseEquation, balanceEquation, generateEducationalSteps } from '../simulators/balanceador-ecuaciones/js/balanceador-core.js';
import fs from 'fs';

const stringifyEquation = (parsed) => {
    const side = arr => arr.map(s => `${s.coeff > 1 ? s.coeff : ''}${s.formula}`).join(' + ');
    return `${side(parsed.reactants)} -> ${side(parsed.products)}`;
};

const testCases = {
  "Básicos": [
    { input: "H2 + O2 -> H2O", expected: "2H2 + O2 -> 2H2O" },
    { input: "C + O2 -> CO2", expected: "C + O2 -> CO2" },
    { input: "H2 + Cl2 -> HCl", expected: "H2 + Cl2 -> 2HCl" }
  ],
  "Intermedios": [
    { input: "N2 + H2 -> NH3", expected: "N2 + 3H2 -> 2NH3" },
    { input: "Fe + O2 -> Fe2O3", expected: "4Fe + 3O2 -> 2Fe2O3" },
    { input: "CH4 + O2 -> CO2 + H2O", expected: "CH4 + 2O2 -> CO2 + 2H2O" },
    { input: "Al + O2 -> Al2O3", expected: "4Al + 3O2 -> 2Al2O3" }
  ],
  "Avanzados": [
    { input: "C2H6 + O2 -> CO2 + H2O", expected: "2C2H6 + 7O2 -> 4CO2 + 6H2O" },
    { input: "C3H8 + O2 -> CO2 + H2O", expected: "C3H8 + 5O2 -> 3CO2 + 4H2O" },
    { input: "NaOH + H2SO4 -> Na2SO4 + H2O", expected: "2NaOH + H2SO4 -> Na2SO4 + 2H2O" },
    { input: "Ca(OH)2 + HCl -> CaCl2 + H2O", expected: "Ca(OH)2 + 2HCl -> CaCl2 + 2H2O" },
    { input: "Al + HCl -> AlCl3 + H2", expected: "2Al + 6HCl -> 2AlCl3 + 3H2" }
  ],
  "Expertos": [
    { input: "C4H10 + O2 -> CO2 + H2O", expected: "2C4H10 + 13O2 -> 8CO2 + 10H2O" },
    { input: "H3PO4 + NaOH -> Na3PO4 + H2O", expected: "H3PO4 + 3NaOH -> Na3PO4 + 3H2O" },
    { input: "2Na2O2 + 2H2O -> 4NaOH + O2", expected: "2Na2O2 + 2H2O -> 4NaOH + O2" } // This one has coefficients on the left, but our parser might ignore or handle it
  ],
  "Parser edge cases": [
    { input: "H2+O2->H2O", expectError: false },
    { input: "2H2 + O2 --> H2O", expectError: true },
    { input: "H2 + O2 => H2O", expectError: true },
    { input: "", expectError: true },
    { input: "H2O", expectError: true },
    { input: "H2 + O2 ->", expectError: true },
    { input: "-> H2O", expectError: true },
    { input: "XYZ + O2 -> XO2", expectError: true },
    { input: "H2 + O2 -> H2O2", expectError: true } // actually it balances with H2 + O2 -> H2O2, expect error in balance or success? Actually it's valid. Wait, it's already balanced.
  ],
  "Solver edge cases": [
    { input: "C6H12O6 + O2 -> CO2 + H2O", expectError: false },
    { input: "Fe2(SO4)3 + NaOH -> Fe(OH)3 + Na2SO4", expectError: false },
    { input: "KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2", expectError: false },
    { input: "Na2O2 + H2O -> NaOH + O2", expectError: false }
  ],
  "Coefficient edge cases": [
    { input: "C + O2 -> CO2", expectError: false },
    { input: "C2H2 + O2 -> CO2 + H2O", expectError: false }
  ]
};

let output = [];

for (const [group, cases] of Object.entries(testCases)) {
  output.push(`### ${group}`);
  for (const c of cases) {
    try {
      const parsed = parseEquation(c.input);
      const res = balanceEquation(parsed);
      const resStr = stringifyEquation(res.balanced);
      // We also test generateEducationalSteps
      generateEducationalSteps(c.input);
      
      if (c.expected) {
        if (resStr === c.expected) {
          output.push(`✅ Pasa — ${c.input} => ${resStr}`);
        } else {
          output.push(`❌ Falla — ${c.input} | Esperado: ${c.expected} | Obtenido: ${resStr}`);
        }
      } else {
        if (c.expectError) {
          output.push(`❌ Falla — ${c.input} | Esperaba error pero pasó silenciosamente => ${resStr}`);
        } else {
          output.push(`✅ Pasa (Sin crash) — ${c.input} => ${resStr}`);
        }
      }
    } catch (e) {
      if (c.expectError) {
        output.push(`✅ Pasa (Error manejado) — ${c.input} => ${e.message}`);
      } else if (c.expected) {
        output.push(`❌ Falla (Crash inesperado) — ${c.input} => ${e.message}`);
      } else {
        output.push(`⚠️ Comportamiento (Crash/Error) — ${c.input} => ${e.message}`);
      }
    }
  }
  output.push('');
}

console.log(output.join('\n'));
