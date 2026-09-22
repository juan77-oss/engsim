/**
 * ui/modal.js — Modal PRO · Combustión
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE : Placeholder para el modal de upgrade PRO.
 *           En FASE 1 no hay outputs PRO, pero la arquitectura
 *           debe soportarlo desde el inicio.
 *
 * EXPORTS :
 *   showUpgradeModal()  → muestra el modal de upgrade
 *   hideUpgradeModal()  → oculta el modal
 * ─────────────────────────────────────────────────────────────────
 */


// ═══════════════════════════════════════════════
//  DEFAULTS — Contenido del modal
// ═══════════════════════════════════════════════

const MODAL_CONFIG = {
    title:       '🚀 Unlock Engineering Analysis',
    description: 'Take your simulation to the next level with optimization tools and professional export.',
    features: [
        '🚀 Fuel Mixer (Biomass + Coal)',
        '⚖️ Excess Air Optimizer (λ)',
        '📊 Parallel Performance Comparator',
        '📄 Technical Report Exporter (PDF/CSV)',
        '🧠 Advanced Engineering Insights'
    ],
    pricing: [
        { label: 'Exam Pass (7 days)', price: '$2.800 ARS', note: 'Ideal for midterms week' },
        { label: 'Monthly Subscription', price: '$5.500 ARS', note: 'Equivalent to 1.5 coffees' },
        { label: 'Lifetime Access', price: '$14.500 ARS', note: 'For your entire career' }
    ],
    cta: 'Select Plan'
};


// ═══════════════════════════════════════════════
//  _ensureModal()  — Construye el modal una vez
// ═══════════════════════════════════════════════

function _ensureModal() {
    if (document.getElementById('comb-pro-modal')) return;

    const modal = document.createElement('div');
    modal.id        = 'comb-pro-modal';
    modal.className = 'sim-modal';
    modal.setAttribute('role',            'dialog');
    modal.setAttribute('aria-modal',      'true');
    modal.setAttribute('aria-labelledby', 'comb-modal-title');

    const features = MODAL_CONFIG.features
        .map(f => `<li>&#10004; ${f}</li>`)
        .join('');

    const pricing = MODAL_CONFIG.pricing
        .map(p => `
            <div class="sim-modal__price-card">
                <div class="sim-modal__price-label">${p.label}</div>
                <div class="sim-modal__price-value">${p.price}</div>
                <div class="sim-modal__price-note">${p.note}</div>
            </div>
        `)
        .join('');

    modal.innerHTML = `
        <div class="sim-modal__content sim-modal__content--tiered">
            <h2 id="comb-modal-title">${MODAL_CONFIG.title}</h2>
            <p>${MODAL_CONFIG.description}</p>
            <ul class="sim-modal__features">${features}</ul>
            <div class="sim-modal__pricing-grid">${pricing}</div>
            <button class="sim-modal__cta" type="button" id="comb-modal-cta">
                ${MODAL_CONFIG.cta}
            </button>
            <button class="sim-modal__close" type="button" id="comb-modal-close">
                Return to simulator
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // Cerrar con botón
    document.getElementById('comb-modal-close')
        .addEventListener('click', hideUpgradeModal);

    // Cerrar haciendo click en el backdrop
    modal.addEventListener('click', e => {
        if (e.target === modal) hideUpgradeModal();
    });

    // CTA — placeholder para integración de pago futura
    document.getElementById('comb-modal-cta')
        .addEventListener('click', () => {
            console.info('[modal] Upgrade intent — simulador: combustion');
            // TODO: conectar a proveedor de pago (Stripe / MercadoPago)
        });
}


// ═══════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════

/**
 * Muestra el modal PRO de combustión.
 */
export function showUpgradeModal() {
    _ensureModal();
    document.getElementById('comb-pro-modal').classList.add('active');
}

/**
 * Oculta el modal PRO.
 */
export function hideUpgradeModal() {
    const modal = document.getElementById('comb-pro-modal');
    if (modal) modal.classList.remove('active');
}
