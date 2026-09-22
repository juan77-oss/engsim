import { 
  parseMolecularFormula, 
  calculateMolarMass, 
  parseEquation, 
  balanceEquation, 
  calculateLimitingReagent, 
  getRedoxReaction 
} from '../simulators/chemical-reactions/js/core.js';
import { REDOX_REACTIONS } from '../simulators/chemical-reactions/js/constants.js';

console.log("=== 1. Redox _hasToken ===");
const res1 = getRedoxReaction("BaCl2 + NaOH -> Ba(OH)2 + NaCl");
console.log("BaCl2 + NaOH -> Ba(OH)2 + NaCl matched:", res1 ? res1.id : "null");

const ex1 = getRedoxReaction("MnO4- + Fe2+ -> Mn2+ + Fe3+");
console.log("ex1 matched:", ex1 ? ex1.id : "null");
const ex2 = getRedoxReaction("Cr2O7(2-) + I- -> Cr3+ + I2");
console.log("ex2 matched:", ex2 ? ex2.id : "null");
const ex3 = getRedoxReaction("Cl2 + NaOH -> NaCl + NaClO + H2O");
console.log("ex3 matched:", ex3 ? ex3.id : "null");


console.log("\n=== 2. Limiting Reagent Tie ===");
const limRes = calculateLimitingReagent("C + O2 -> CO2", [
  { value: 1, unit: "mol" },
  { value: 1, unit: "mol" }
]);
console.log("isLimiting in ratioTable:", limRes.ratioTable.map(r => r.isLimiting));
console.log("isLimiting in excessData:", limRes.excessData.map(r => r.isLimiting));


console.log("\n=== 3. Symmetric Balance Validation ===");
try {
  balanceEquation(parseEquation("H2 -> H2O"));
  console.log("H2 -> H2O DID NOT throw");
} catch (e) {
  console.log("H2 -> H2O threw:", e.message);
}


console.log("\n=== 4. parseMolecularFormula parens ===");
try {
  parseMolecularFormula("Ca(OH)2)");
  console.log("Ca(OH)2) DID NOT throw");
} catch (e) {
  console.log("Ca(OH)2) threw:", e.message);
}

try {
  parseMolecularFormula("Ca((OH)2");
  console.log("Ca((OH)2 DID NOT throw");
} catch (e) {
  console.log("Ca((OH)2 threw:", e.message);
}

try {
  console.log("Ca(OH)2 parsed:", parseMolecularFormula("Ca(OH)2"));
} catch (e) {
  console.log("Ca(OH)2 threw:", e.message);
}

console.log("\n=== 5. Underdetermined System ===");
try {
  balanceEquation(parseEquation("CH4 + O2 -> C + H2 + H2O"));
  console.log("CH4 + O2 -> C + H2 + H2O DID NOT throw");
} catch (e) {
  console.log("CH4 + O2 -> C + H2 + H2O threw:", e.message);
}

console.log("\n=== 6. Alternative Arrows ===");
try {
  const eq = parseEquation("2H2 + O2 => 2H2O");
  console.log("2H2 + O2 => 2H2O parsed successfully. Reactants:", eq.reactants.length, "Products:", eq.products.length);
} catch (e) {
  console.log("2H2 + O2 => 2H2O threw:", e.message);
}

console.log("\n=== 7. Type Validations ===");
try {
  parseMolecularFormula(123);
  console.log("parseMolecularFormula(123) DID NOT throw");
} catch (e) {
  console.log("parseMolecularFormula(123) threw:", e.message);
}

try {
  calculateMolarMass("not an object");
  console.log("calculateMolarMass('string') DID NOT throw");
} catch (e) {
  console.log("calculateMolarMass('string') threw:", e.message);
}

try {
  calculateLimitingReagent("H2 + O2 -> H2O", "not an array");
  console.log("calculateLimitingReagent(..., 'string') DID NOT throw");
} catch (e) {
  console.log("calculateLimitingReagent(..., 'string') threw:", e.message);
}

console.log("\n=== NEW REVIEW ===");
console.log("Testing UI Examples");
const ui1 = calculateLimitingReagent("2H2 + O2 -> 2H2O", [{value: 4, unit: 'g'}, {value: 32, unit: 'g'}]);
console.log("2H2+O2 Limiting:", ui1.limitingReagent.formula);

const ui2 = calculateLimitingReagent("N2 + 3H2 -> 2NH3", [{value: 28, unit: 'g'}, {value: 3, unit: 'g'}]);
console.log("N2+3H2 Limiting:", ui2.limitingReagent.formula);

const ui3 = calculateLimitingReagent("Fe + S -> FeS", [{value: 56, unit: 'g'}, {value: 16, unit: 'g'}]);
console.log("Fe+S Limiting:", ui3.limitingReagent.formula);
