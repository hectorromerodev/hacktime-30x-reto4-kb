# Charla: Human in the Loop — "Doble Check Humano" (Dr. Julio César Murcia, MinTIC) — findings for Reto 4
Video: https://www.youtube.com/watch?v=0GsbetGl-JU (2026-07-25, ~38 min)

> Note on transcript quality: Auto-captions are Spanish, presenter is Julio César Murcia, Director of Colombia's National AI Policy (Política Nacional de Inteligencia Artificial) at the Ministry of Information Technology (MinTIC), and mentor for AI at EAAFED; he emphasizes "EA for Good" — amplifying human capability, not replacing it. Talk given on 2026-07-25 (day before demo submission), directly relevant to governance, ethics, and UX in AI-assisted workflows. Speaker style is conversational, with frequent asides; quotation marks used where Julio emphasizes a phrase or direct example.

## What "Human in the Loop" means (three levels of autonomy)

Julio structures **human oversight in AI workflows** as three bands, ranging from human-controlled to increasingly AI-autonomous:

1. **Human-in-the-middle (or "human informed"):** `"el humano decide la la sugiere o genera borradores"` — the human approves/rejects each AI output before it takes effect. Slowest, highest oversight.

2. **Human-in-the-loop (HITL):** `"el que acabamos de ver"` — the human *validates a checkpoint* inside the AI's decision cycle. Julio's diagram: **input** → **LLM tools** → **HITL checkpoint (human audits the model's reasoning)** → **output**. Julio's framing: `"cuando tú haces un proceso cíclico o en loop, el humano esté dentro del mismo loop"` — the human is *inside* the cycle, not gating the final result. *This is the middle band.*

3. **Human-on-the-side (or "human oversight"):** `"el otro es human... que es cuando la opera de manera un poco más autónoma, no está como digamos ya le dio el el loop el humano y la validación técnica y la IA puede tener más capacidad de decisión"` — the AI makes decisions semi-autonomously, and the human audits/monitors after the fact (or via logged decisions). Fastest, lowest real-time friction.

**Key insight for reto-4:** Our blind-count + anomaly-flag workflow is **firmly in the HITL band**. The app says *"900 litros está fuera de la escala habitual de este artículo en esta bodega — cuenta otra vez para confirmar"* — that checkpoint is *inside* the counting loop, and it fires **before save**. The counter does not defer to the app; the counter decides. The app assists.

> ⚠️ Corregido: decía ~~*"this count is 5x yesterday's average"*~~. No hay histórico. La comparación es contra el **orden de magnitud** del corte, que es lo único que el dispositivo conoce — y que no revela la cantidad esperada.

## The validation framework: five ethical checkpoints for LLM-assisted workflows

Julio lists **five validations every AI/LLM integration should address** (adapted for MVP/hackathon pace):

### 1. **Data provenance & consent** (`"¿De dónde vienen los datos? ¿De dónde salió ese dataset?"`)
- Where did the training data / context data come from?
- Do you have permission to use it (open data, licensed, proprietary)?
- Is the data representative or biased toward certain profiles?

For reto-4: Our fuzzy-match dataset is the Colsubsidio catalog of ~936 articles. We have permission (provided by Colsubsidio). But: **are there article names or variants in the catalog we haven't tested?** (e.g., "harina de maíz" vs. "maíz harina" vs. "harina maiz" — misspelling). This is a **known limitation** worth documenting.

### 2. **Explainability of output** (`"¿Por qué puedes explicar una fase el modelo y por qué generó ese output?"`)
- Can you trace *why* the LLM flagged this count as anomalous?
- Julio emphasizes: `"alguien que de afuera no esté tan sesgado y no sea tan técnico"` — even a non-technical reviewer should be able to understand the reason.

For reto-4: If the app flags "9 cajas de harina" as an anomaly, can we explain to the counter *why*? Examples:
- *"Yesterday you logged 1 caja; this is 9x higher."* (historical comparison) ← explainable.
- *"The fuzzy-match confidence is 0.72, which is below 0.85 threshold."* ← too technical for a warehouse counter; needs human translation.

**Implementation implication:** el aviso explica el motivo en español llano, sin score y sin
revelar la cantidad esperada. Copia tal como quedó construida:

> *"900 litros está fuera de la escala habitual de ACEITE en esta bodega. Cuenta otra vez
> para confirmar."* — con **Volver a teclear** como acción primaria.

> ⚠️ **CORREGIDO.** La redacción anterior era
> ~~*"Eso es muy diferente del reporte de ayer (1 caja)"*~~: inventaba un histórico que no
> existe **y** habría filtrado el dato del sistema, rompiendo el conteo ciego.

### 3. **Real-world impact** (`"¿Eso genera un impacto real en las personas o no?"`)
- Does the AI decision actually improve the counter's life or audit quality, or is it theater?
- Who benefits? Who might be harmed?

For reto-4: **Benefit:** The counter avoids a 9↔90 error making it to the system; the auditor does not waste time re-validating known-bad entries. **Potential harm:** If the anomaly threshold is too aggressive, the counter gets nagged into second-guessing correct counts (psychological fatigue). **Potential harm:** If the app is down/offline and the counter cannot re-count mid-session, they're stuck.

### 4. **Hallucination & verification** (`"Verificación de alucinaciones, las cajas negras, contraste, cifras, nombres, cifras generadas, fuente real"`)
- Can the model confabulate (e.g., invent an article name that's not in the catalog)?
- If it compares this count to "yesterday's," how do you verify yesterday's value is real and not a model guess?
- **Explicit test case Julio gives:** A model asked "what's the protein requirement?" might hallucinate a specific number instead of saying "I don't have that data."

For reto-4: **Risks:**
- Voice transcription error: counter says "harina" but the app hears "ahora" (now). Fuzzy-match tries to find an article called "ahora" and fails or matches something wrong.
- Anomaly threshold was trained on old data and no longer applies. (Example: a bodega started stocking a new product; suddenly all counts look anomalous because the model expects the old distribution.)
- **Mitigation:** Human explicitly re-counts and confirms. The app is a *check*, not the source of truth. The counter's voice/recount is the source of truth.

### 5. **Reversibility** (`"¿Eso es reversible o no es reversible?"`)
- If the AI-assisted decision was wrong, can you undo it? Is there an audit trail?
- Or does it roll forward and become baked into the system?

For reto-4: **Yes, reversible.** The counter recounts if the flag triggers doubt, so a wrong anomaly flag is caught mid-session. **But:** if a wrong count (not flagged) makes it through and is entered into the system, the auditor will catch it during their 2-day review, but *correcting it requires rework*. So there's a "soft" reversal (human audit + manual correction) but not a "hard" undo in real-time.

**This is acceptable for a MVP.** Julio's point is to **document the limitation:** "The app flags anomalies but relies on the counter's judgment. If a count passes without a flag and the auditor later finds it's wrong, correction is manual and costly."

## Bias mitigation in a 48-hour hackathon

Julio names **four bias vectors** that arise when LLMs are integrated quickly:

1. **Data bias:** The training data skews the model's answers.
2. **Confirmation bias:** The team accepts the first model output that matches their expectation, without testing other scenarios.
3. **Interaction bias:** The model learns from early users' behavior and amplifies it (e.g., if the first counter always says "harina" for flour, the model overfits to that speaker).
4. **Automation bias:** The team trusts the model output without critical review. `"El equipo confía más de lo que eh arrojó la IA sin necesidad de hacer la verificación y sin ser crítico en el desarrollo de la solución."`

### Mitigation tactics for reto-4 (with brutal honesty about 48-hour feasibility):

**Diversify test profiles:**
> Test your voice-to-fuzzy-match with **at least 3 different speakers** (not just the person building it). Test with different accents, speeds, and clarity levels (clear speaker vs. someone with a cold, shouting over warehouse noise, etc.). Julio: `"Prueba tu MVP en diferentes perfiles y distintos de grupos de edad etéreos, hombre, mujer, rangos de edad."` For us: different bodega staff, different comfort levels with technology.

**Audit the prompt, not just the output:**
> Julio: `"audit el prom, no solo el output"` — review the system prompt guiding the fuzzy-match and anomaly logic. Ask: *Does the prompt assume articles are always spelled one way? Does it assume counts never double overnight (e.g., a restock)? Does it assume the counter always speaks clearly?* Write down the assumptions. In your demo pitch, mention at least one assumption you're aware of.

**Involve a non-technical reviewer:**
> `"Una mirada humana, alguien que dentro del equipo... Alguien que de afuera no esté tan sesgado y no sea tan técnico que diga, 'Venga, yo quiero mirar eso desde el comienzo.'"` If someone on the team is less technical, have them use the app like a real counter would. Do they understand what the app is asking them to do? Can they recover if they mis-speak? Their feedback is gold.

**Focus on UX clarity:**
> Julio: `"Experiencia de usuario es clave... todo tiene que ser supercaro para las personas"` (clear/easy for people). When the app flags an anomaly, is the voice message understandable? Does it make the counter feel nagged or supported? `"Prueba dos. ¿Probaste el MVP con datos o perfiles distintos a todos los del equipo? Importante."`

**Document limitations upfront:**
> Julio: `"Declara en el pitch las limitaciones y sesgos conocidos. Eso es ganador."` In your pitch: *"Our fuzzy-match works for exact and 1-character-off spellings, but not for abbreviations (e.g., if someone calls it 'har' for 'harina', we won't recognize it). A real deployment would need a controlled vocabulary or barcode, which we're working toward."* **This sounds like a strength to judges because it shows critical thinking.** Judges expect MVPs to have limitations; hiding them is worse.

## Cognitive overload & critical thinking: the "System 2" warning

Julio cites **Daniel Kahneman's "Thinking, Fast and Slow"** model:
- **System 1 thinking:** Fast, automatic, intuitive. Prone to bias.
- **System 2 thinking:** Slow, deliberative, logical. Critical evaluation.

Julio's concern: When developers copy-paste AI output without validating it, they default to System 1 and **lose the habit of System 2 thinking**. He calls this `"cognitive offloading"` or `"descarga cognitiva."` `"estamos descargando cognitivamente el cerebro en la inteligencia artificial."` By outsourcing the reasoning to the AI without questioning, humans atrophy their critical muscle.

**For reto-4 context:** If your team codes the fuzzy-match by asking an LLM "write me a fuzzy-match function" and pastes the result without understanding or testing it, you're vulnerable to bugs (misaligned thresholds, poor performance on edge cases). **The antidote:** At least one team member understands the fuzzy-match logic deeply enough to explain it and spot a failure mode.

Julio's final principle: `"el que desarrolle esta skill de desarrolle pensamiento del sistema dos deliberativo y crítico más las soft skills... va a generar una capacidad increíble de relacionamiento, de trabajos, de proyectos, etcétera."` **Developers who combine System 2 critical thinking with soft skills (communication, empathy, adaptability) are the ones who go far.**

## Sustainability & governance for post-hackathon life

Julio stresses that **hackathons are not where projects die**; they're where they *begin*. For reto-4 to survive the Sunday submission, Julio implies you need:

1. **Code review & documentation:** Even in a rush, clean commits and a README help the judges (and eventual Colsubsidio devs) understand your architecture.
2. **Token/API cost awareness:** If you're using LLMs for fuzzy-match or anomaly detection, are you aware of the cost? Can you run this on 48 bodegas × 1405 counts per month without hitting rate limits?
3. **Minimal maintenance plan:** If Colsubsidio picks up the project, what breaks first? What's the on-call burden?
4. **Data governance:** Which Colsubsidio data are you storing? For how long? Can it be audited?

Julio mentions a **Colombia-specific AI policy framework** (COMPES 4.14, National AI Policy, UNESCO ethics recommendations) that hackathon winners should be aware of. It's not a hard blocker for a hackathon MVP, but it signals to judges that you're thinking beyond the weekend.

## Mapped to our reto-4 anomaly-confirmation-before-save flow

### The HITL checkpoint in our blind-count workflow:

> ⚠️ **CORREGIDO.** El diagrama original tenía dos errores graves: inventaba un histórico
> (*"Yesterday: 1 caja"*) que **no existe**, y hacía que la app dijera *"eso es muy diferente
> del reporte de ayer (1 caja)"*, lo cual **revelaría la cantidad esperada y rompería el
> conteo ciego** — justo el control que Colsubsidio pidió proteger.
>
> Abajo va el flujo tal como está construido.

```
El contador captura 900 (por voz, teclado o escaneo)
    ↓
[Emparejador + reglas — TypeScript en el dispositivo, sin red y sin LLM]
    ├─ Reconoce: ACEITE (catálogo de la bodega)
    ├─ ¿Coincidencia segura?  score 0,97 y margen amplio → sí
    └─ ¿Escala inusual?  el dispositivo tiene exp10=1 ("decenas"); 900 es orden 2 → MARCA
                          (nunca recibió el 30,59: solo la escala)
    ↓
[Punto de control humano] ← AQUÍ ESTÁ LA VALIDACIÓN HITL, ANTES DE GUARDAR
    ├─ "900 litros está fuera de la escala habitual de ACEITE en esta bodega.
    │   Cuenta otra vez para confirmar."
    ├─ Tres salidas:
    │   ├─ [Volver a teclear]  ← acción PRIMARIA: re-teclear es lo que mata el error
    │   ├─ [¿Eran 90?]         ← el vecino de un dígito, solo si cae en la escala esperada
    │   └─ [Es correcto]       ← exige elegir un motivo antes de habilitarse
    ↓
[Si acepta]: se guarda, y el motivo queda en la hoja TRAZABILIDAD para el auditor.
[Si re-teclea]: vuelve al teclado; si las dos capturas coinciden, guarda sin molestar.
```

**Key properties:**
- **The app never decides for the counter.** The counter decides.
- **The check happens *before* save**, so a mistake is caught immediately.
- **The blind-count rule is preserved:** The app never says "the system expects 1 caja; you said 9." It only says "this is unusual."
- **The human is *inside* the loop**, not gated at the end.

### Ethical validations applied to our HITL checkpoint:

1. **Data provenance:** Catalog of 936 articles provided by Colsubsidio. ✓
2. **Explainability:** `"900 litros está fuera de la escala habitual de ACEITE en esta bodega."` — el contador entiende *por qué* se marcó, en español llano y sin un score. Y sin revelar la cantidad esperada. ✓
   *(Corregido: la versión anterior citaba una comparación "con el reporte de ayer" que habría filtrado el dato del sistema.)*
3. **Real-world impact:** Eliminates the 9↔90 error before it costs 2 days of auditing. ✓
4. **Hallucination & verification:** If fuzzy-match fails (e.g., an unrecognized article name), the counter notices and can correct. The app doesn't try to "guess" — it asks for re-confirmation. ✓
5. **Reversibility:** Counter can re-count immediately within the same session. ✓

### Bias mitigation for the confirmation flow:

- **Test with different speakers:** Does the voice recognition work for a counter with a regional accent? With a hoarse voice? Will the fuzzy-match still work?
- **Audit the anomaly threshold:** Is 3x the right multiplier for all articles? (Some articles might naturally have high variance; others should be tightly controlled. A manual tweak per bodega or per category is reasonable for a post-hackathon roadmap, but document it in your pitch.)
- **Have a non-technical team member test it:** Do they feel guided by the app, or nagged? Does the voice message feel supportive?
- **Document known limitations:** `"Our fuzzy-match may not recognize abbreviated or misspelled article names. If a counter says 'har' instead of 'harina,' the app won't find a match. A future version could use barcodes to disambiguate."` This is a **strength in your pitch**, not a weakness, because it shows you've thought about failure modes.

### Avoiding automation bias in the demo:

During the final Q&A with judges, if they ask *"What if the anomaly flag is wrong?"*:
- **Do NOT say:** `"Oh, the AI would never flag it wrong."` ← Automation bias.
- **DO say:** `"The flag is a heuristic based on 30-day history. If the counter is confident, they confirm. But we log the override in the audit trail so the auditor can see it and decide whether the heuristic needs tuning."` ← Critical thinking + reversibility.

## Caveats & tensions

- **Voice recognition in a noisy warehouse is not trivial.** Julio doesn't mention noise robustness, but Colsubsidio's note is that voice capture is pre-validated by their team. **Assume you're working with a clean input channel** for the hackathon, but flag this as a post-MVP challenge for a real warehouse.
- **48-hour timeline vs. rigorous bias testing.** Julio's five validations and bias mitigation are *ideals*. In a 48-hour hackathon, you won't have time to test with dozens of profiles or iterate on the anomaly threshold. **Be explicit about this in your pitch.** `"We tested the fuzzy-match with 3 team members and one non-technical reviewer [names]. In a pilot, we'd expand to 20+ counters across multiple bodegas to validate threshold sensitivity."` Judges respect honesty about scope.
- **Cognitive overload risk for your own team.** Julio warns about "cognitive offloading." Don't let your team paste LLM code without understanding it. **Assign one person to own the fuzzy-match logic and be able to explain it.** This pays dividends in Q&A.

---

## Verdict: HITL principles for reto-4 confirmation UX

1. **Flag, never decide.** The app flags anomalies; the counter decides.
2. **Explain the reason in plain language.** Not "confidence=0.72 below threshold=0.85." Say *"está fuera de la escala habitual de este artículo en esta bodega"* — motivo entendible, sin score y sin filtrar la cantidad que espera el sistema. *(Corregido: decía ~~"This is 5x yesterday's count"~~, que asume un histórico inexistente.)*
3. **Offer a fast recovery path.** If the flag is wrong, the counter can re-count immediately. No modal purgatory.
4. **Log the override.** If the counter says "Sí" to a flagged anomaly, record it so the auditor can see and audit the decision.
5. **Preserve the blind-count rule.** Never reveal the "expected" quantity to the counter. The flag is "unusual," not "wrong."
6. **Test with non-builders.** Have someone outside the tech team try the UX. Is it clear? Is it respectful to the counter's expertise?
7. **Document limitations upfront.** In the pitch and README, list what your fuzzy-match *doesn't* handle (abbreviations, misspellings, new article names). This is a strength, not a weakness.
8. **Practice explaining your design choices.** In the 3-minute Q&A, judges will ask "Why this anomaly threshold?" or "What if the historical data is stale?" You need System 2 thinking, not autopilot.

---END---
