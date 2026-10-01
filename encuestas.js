/* ═══════════════════════════════════════════════════════════════════
   encuestas.js — Módulo Encuestas · Azyvion CRM  (Supabase edition)
   Requiere globales: _sb(), escHtml(), showToast(), openModal(),
                      closeModal(), _encuestas, _modalMode
═══════════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────────
   HELPERS INTERNOS
────────────────────────────────────────────────────────────────── */
function _encSb()        { return window._sb; }
function _encSet(id, v)  { const el = document.getElementById(id); if (el) el.textContent = v; }
function _encHtml(id, v) { const el = document.getElementById(id); if (el) el.innerHTML   = v; }

/* ──────────────────────────────────────────────────────────────────
   CARGA DE ENCUESTAS (desde Supabase)
────────────────────────────────────────────────────────────────── */
async function loadEncuestas() {
    const grid = document.getElementById('surveyGrid');
    if (grid) grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Cargando encuestas…</div>';

    try {
        /* Traer encuestas con conteo de preguntas y envíos */
        const { data: encData, error: encErr } = await _encSb()
            .from('encuestas')
            .select('*')
            .order('created_at', { ascending: false });

        if (encErr) throw encErr;

        /* Conteos separados (más fiable que el agregado inline en v2) */
        const ids = (encData || []).map(e => e.id);
        let pregCounts = {}, envioCounts = {};

        if (ids.length) {
            const [pregRes, envRes] = await Promise.all([
                _encSb().from('encuesta_preguntas')
                        .select('encuesta_id')
                        .in('encuesta_id', ids),
                _encSb().from('encuesta_envios')
                        .select('encuesta_id')
                        .in('encuesta_id', ids)
            ]);

            (pregRes.data  || []).forEach(r => { pregCounts[r.encuesta_id]  = (pregCounts[r.encuesta_id]  || 0) + 1; });
            (envRes.data   || []).forEach(r => { envioCounts[r.encuesta_id] = (envioCounts[r.encuesta_id] || 0) + 1; });
        }

        /* Normalizar y guardar en estado global */
        _encuestas = (encData || []).map(e => ({
            ...e,
            pregConf:      pregCounts[e.id]  || 0,
            pregTotal:     e.preg_total      || 5,
            totalEnviadas: envioCounts[e.id] || 0,
            respuestas:    envioCounts[e.id] || 0   // cada envío = respuesta completada
        }));

        renderEncuestas();
        _actualizarKpisEncuestas();

    } catch (err) {
        console.error('[Encuestas]', err);
        showToast('Error cargando encuestas: ' + (err.message || err), '#FF453A');
        if (grid) grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">Error al cargar. Verifica tu conexión.</div>';
    }
}

function _actualizarKpisEncuestas() {
    const activas   = _encuestas.filter(e => e.estado === 'Activa').length;
    const totalResp = _encuestas.reduce((s, e) => s + Number(e.respuestas    || 0), 0);
    const totalEnv  = _encuestas.reduce((s, e) => s + Number(e.totalEnviadas || 0), 0);
    const tasa      = totalEnv > 0 ? Math.round(totalResp / totalEnv * 100) : 0;

    _encSet('enc-activas', activas);
    _encSet('enc-resp',    totalResp);
    _encSet('enc-tasa',    tasa + '%');
    _encSet('enc-env',     totalEnv);
}

/* ──────────────────────────────────────────────────────────────────
   RENDER — GRID DE ENCUESTAS
────────────────────────────────────────────────────────────────── */
function renderEncuestas() {
    const grid = document.getElementById('surveyGrid');
    if (!grid) return;

    const cards = _encuestas.map(e => {
        const pct    = Number(e.totalEnviadas) ? Math.round(Number(e.respuestas) / Number(e.totalEnviadas) * 100) : 0;
        const pConf  = Number(e.pregConf  || 0);
        const pTot   = Number(e.pregTotal || 5);
        const pPct   = pTot ? Math.round(pConf / pTot * 100) : 0;
        const activo = e.estado === 'Activa';
        const borr   = e.estado === 'Borrador';

        const estadoTag = activo
            ? '<span class="tag tag-success">Activa</span>'
            : borr
            ? '<span class="tag tag-warning">Borrador</span>'
            : '<span class="tag tag-gray">' + escHtml(e.estado || '—') + '</span>';

        const fecha = e.fecha_envio
            ? new Date(e.fecha_envio).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })
            : e.created_at
            ? new Date(e.created_at).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—';

        const metaLine = activo
            ? `Enviada el ${fecha} · ${e.respuestas} ${e.respuestas === 1 ? 'respuesta' : 'respuestas'}`
            : borr
            ? `Creada el ${fecha} · Sin enviar aún`
            : `Cerrada el ${fecha}`;

        const statLabel = activo ? 'Tasa de respuesta'       : 'Preguntas configuradas';
        const statVal   = activo ? pct + '%'                 : `${pConf} / ${pTot}`;
        const fillClass = activo ? ''                        : 'mid';
        const fillW     = activo ? pct                       : pPct;

        const warningBox = borr ? `
        <div style="background:var(--warning-bg);border-radius:9px;padding:10px 12px;font-size:12.5px;color:#a06000;line-height:1.4;margin-bottom:10px;">
            Faltan ${pTot - pConf} preguntas por configurar antes de enviar.
        </div>` : '';

        const respBtn = (activo || e.respuestas > 0) ? `
        <button class="topbar-btn" style="height:30px;font-size:12px;background:var(--accent);color:#fff;"
                onclick="verRespuestasEncuesta('${e.id}')">
            Ver respuestas (${e.respuestas})
        </button>` : '';

        return `<div class="survey-card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div class="survey-name">${escHtml(e.nombre)}</div>${estadoTag}
    </div>
    <div class="survey-meta" style="margin-bottom:10px;">${metaLine}</div>
    <div class="survey-stat">
        <span class="survey-stat-label">${statLabel}</span>
        <span class="survey-stat-value">${statVal}</span>
    </div>
    <div class="progress-bar" style="margin-bottom:14px;height:6px;">
        <div class="progress-fill ${fillClass}" style="width:${fillW}%"></div>
    </div>
    ${warningBox}
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${respBtn}
        <button class="topbar-btn" style="height:30px;font-size:12px;" onclick="editEncuesta('${e.id}')">Editar</button>
        <button class="btn-danger-sm" style="height:30px;" onclick="confirmDeleteEncuesta('${e.id}','${escHtml(e.nombre)}')">Eliminar</button>
    </div>
</div>`;
    });

    /* Tarjeta "Nueva encuesta" */
    cards.push(`<div class="survey-card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:220px;border-style:dashed;cursor:pointer;background:#FAFAFA;" onclick="newEncuesta()">
    <div style="width:44px;height:44px;border-radius:50%;background:var(--accent-bg);display:flex;align-items:center;justify-content:center;margin-bottom:12px;">
        <svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--accent);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none;">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
    </div>
    <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Nueva encuesta</div>
    <div style="font-size:12.5px;color:var(--text-secondary);">Crea y envía en minutos</div>
</div>`);

    grid.innerHTML = cards.join('');
}

/* ──────────────────────────────────────────────────────────────────
   VER RESPUESTAS — PANEL LATERAL
────────────────────────────────────────────────────────────────── */
function _initEncRespPanel() {
    if (document.getElementById('encRespPanel')) return;
    const panel = document.createElement('div');
    panel.id = 'encRespPanel';
    panel.style.cssText = [
        'position:fixed;top:0;right:-100%;width:min(680px,100vw);height:100vh',
        'background:var(--bg,#F2F2F7);z-index:800;display:flex;flex-direction:column',
        'box-shadow:-8px 0 40px rgba(0,0,0,.18);transition:right .3s cubic-bezier(.4,0,.2,1)',
        'border-left:1px solid var(--border)'
    ].join(';');
    panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--card);flex-shrink:0;">
            <button onclick="_closeEncRespPanel()" style="width:34px;height:34px;border-radius:50%;border:1px solid var(--border);background:var(--bg);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;stroke-width:2;stroke-linecap:round;fill:none;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div>
                <div id="encRespPanelTitle" style="font-size:15px;font-weight:700;color:var(--text-primary)">Respuestas</div>
                <div id="encRespPanelSub"   style="font-size:12px;color:var(--text-secondary)">—</div>
            </div>
        </div>
        <div id="encRespPanelBody" style="flex:1;overflow-y:auto;padding:16px 20px;">
            <div style="text-align:center;padding:40px;color:var(--text-muted)">Cargando respuestas…</div>
        </div>`;

    /* Overlay */
    const ov = document.createElement('div');
    ov.id = 'encRespOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:799;display:none;';
    ov.onclick = _closeEncRespPanel;

    document.body.appendChild(ov);
    document.body.appendChild(panel);
}

function _openEncRespPanel()  {
    document.getElementById('encRespPanel').style.right    = '0';
    document.getElementById('encRespOverlay').style.display = 'block';
}
function _closeEncRespPanel() {
    document.getElementById('encRespPanel').style.right    = '-100%';
    document.getElementById('encRespOverlay').style.display = 'none';
}

async function verRespuestasEncuesta(id) {
    _initEncRespPanel();
    _openEncRespPanel();

    const enc = _encuestas.find(e => String(e.id) === String(id));
    _encSet('encRespPanelTitle', enc ? escHtml(enc.nombre) : 'Respuestas');
    _encSet('encRespPanelSub',   'Cargando…');
    _encHtml('encRespPanelBody', '<div style="text-align:center;padding:40px;color:var(--text-muted)">Cargando respuestas…</div>');

    try {
        /* Traer todos los envíos de esta encuesta */
        const { data: envios, error: envErr } = await _encSb()
            .from('encuesta_envios')
            .select('*')
            .eq('encuesta_id', id)
            .order('submitted_at', { ascending: false });

        if (envErr) throw envErr;

        if (!envios || envios.length === 0) {
            _encSet('encRespPanelSub', 'Sin respuestas todavía');
            _encHtml('encRespPanelBody', `
                <div style="text-align:center;padding:60px 20px;">
                    <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:var(--text-muted);stroke-width:1.5;fill:none;margin-bottom:16px;display:block;margin-inline:auto;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">Sin respuestas aún</div>
                    <div style="font-size:13px;color:var(--text-secondary);">Cuando alguien complete la evaluación, aparecerá aquí.</div>
                </div>`);
            return;
        }

        /* Traer todas las respuestas de estos envíos */
        const envIds = envios.map(e => e.id);
        const { data: respAll, error: respErr } = await _encSb()
            .from('encuesta_respuestas')
            .select('*')
            .in('envio_id', envIds)
            .order('pregunta_orden', { ascending: true });

        if (respErr) throw respErr;

        /* Agrupar respuestas por envio_id */
        const respPorEnvio = {};
        (respAll || []).forEach(r => {
            if (!respPorEnvio[r.envio_id]) respPorEnvio[r.envio_id] = [];
            respPorEnvio[r.envio_id].push(r);
        });

        /* Actualizar subtítulo */
        _encSet('encRespPanelSub',
            `${envios.length} ${envios.length === 1 ? 'respuesta' : 'respuestas'} · Última: ${
                new Date(envios[0].submitted_at).toLocaleDateString('es-GT', { day:'numeric', month:'short', year:'numeric' })
            }`);

        /* Render de tarjetas por candidato */
        const html = envios.map((envio, i) => {
            const resps = respPorEnvio[envio.id] || [];
            const nombre = envio.nombre_candidato || 'Candidato sin nombre';
            const email  = envio.email_candidato  || '';
            const puesto = envio.puesto            || '';
            const fecha  = new Date(envio.submitted_at).toLocaleDateString('es-GT', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

            const respHtml = resps.length
                ? resps.map(r => `
                    <div style="margin-bottom:14px;">
                        <div style="font-size:11.5px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">
                            Pregunta ${r.pregunta_orden || '—'} · ${escHtml(r.pregunta_titulo || '')}
                        </div>
                        <div style="font-size:13.5px;color:var(--text-primary);line-height:1.6;background:var(--bg,#F2F2F7);border-radius:8px;padding:10px 12px;white-space:pre-wrap;">${escHtml(r.respuesta || '(sin respuesta)')}</div>
                    </div>`).join('')
                : '<div style="font-size:13px;color:var(--text-muted);font-style:italic;">Sin respuestas registradas.</div>';

            const uid = 'envCard_' + i;
            return `
            <div style="background:var(--card);border-radius:12px;border:1px solid var(--border);margin-bottom:12px;overflow:hidden;">
                <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;"
                     onclick="(function(btn){var body=document.getElementById('${uid}');var open=body.style.display!=='none';body.style.display=open?'none':'block';btn.querySelector('svg').style.transform=open?'':'rotate(180deg)'})(this)">
                    <div style="width:38px;height:38px;border-radius:50%;background:var(--accent-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;font-weight:700;color:var(--accent);">
                        ${escHtml(nombre.charAt(0).toUpperCase())}
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:14px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(nombre)}</div>
                        <div style="font-size:12px;color:var(--text-secondary);">${email ? escHtml(email) + ' · ' : ''}${escHtml(fecha)}</div>
                        ${puesto ? `<div style="font-size:11.5px;color:var(--accent);font-weight:600;">${escHtml(puesto)}</div>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                        <span style="font-size:11.5px;color:var(--text-muted);">${resps.length} resp.</span>
                        <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:var(--text-muted);stroke-width:2;fill:none;transition:transform .2s;flex-shrink:0;">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </div>
                </div>
                <div id="${uid}" style="display:none;padding:14px 16px;border-top:1px solid var(--border);">
                    ${respHtml}
                </div>
            </div>`;
        }).join('');

        _encHtml('encRespPanelBody', html);

    } catch (err) {
        console.error('[Encuestas] verRespuestas:', err);
        _encHtml('encRespPanelBody', `<div style="text-align:center;padding:40px;color:var(--danger)">Error: ${escHtml(err.message || String(err))}</div>`);
    }
}

/* ──────────────────────────────────────────────────────────────────
   MODALES — CREAR / EDITAR / ELIMINAR
────────────────────────────────────────────────────────────────── */
function newEncuesta() {
    _modalMode = { type: 'encuesta', action: 'add', id: null };
    openModal('Nueva encuesta', `
        <div class="form-field">
            <label class="form-label">NOMBRE DE LA ENCUESTA *</label>
            <input class="form-input" id="mEncNombre" placeholder="Ej. NPS Q4 2026" required/>
        </div>
        <div class="form-field">
            <label class="form-label">TIPO</label>
            <select class="form-select" id="mEncTipo">
                <option>NPS</option><option>Escala</option><option selected>Mixta</option><option>Opción múltiple</option>
            </select>
        </div>
        <div class="form-field">
            <label class="form-label">TOTAL DE PREGUNTAS</label>
            <input class="form-input" id="mEncPregTotal" type="number" min="1" value="5"/>
        </div>
        <div class="form-field">
            <label class="form-label">NOTAS (opcional)</label>
            <textarea class="form-input" id="mEncNotas" rows="2" style="height:auto;resize:vertical;" placeholder="Descripción o instrucciones…"></textarea>
        </div>`);
}

function editEncuesta(id) {
    const e = _encuestas.find(x => String(x.id) === String(id));
    if (!e) return;
    _modalMode = { type: 'encuesta', action: 'edit', id };
    const tipos   = ['NPS', 'Escala', 'Mixta', 'Opción múltiple'];
    const estados = ['Borrador', 'Activa', 'Cerrada'];
    openModal('Editar encuesta', `
        <div class="form-field">
            <label class="form-label">NOMBRE *</label>
            <input class="form-input" id="mEncNombre" value="${escHtml(e.nombre)}" required/>
        </div>
        <div class="form-field">
            <label class="form-label">ESTADO</label>
            <select class="form-select" id="mEncEstado">
                ${estados.map(s => `<option${s === e.estado ? ' selected' : ''}>${s}</option>`).join('')}
            </select>
        </div>
        <div class="form-field">
            <label class="form-label">TIPO</label>
            <select class="form-select" id="mEncTipo">
                ${tipos.map(t => `<option${t === e.tipo ? ' selected' : ''}>${t}</option>`).join('')}
            </select>
        </div>
        <div class="form-field">
            <label class="form-label">TOTAL DE PREGUNTAS</label>
            <input class="form-input" id="mEncPregTotal" type="number" min="1" value="${e.preg_total || 5}"/>
        </div>
        <div class="form-field">
            <label class="form-label">NOTAS</label>
            <textarea class="form-input" id="mEncNotas" rows="2" style="height:auto;resize:vertical;">${escHtml(e.notas || '')}</textarea>
        </div>`);
}

function confirmDeleteEncuesta(id, nombre) {
    _modalMode = { type: 'encuesta', action: 'delete', id };
    openModal('Eliminar encuesta', `
        <div style="text-align:center;padding:10px 0">
            <svg viewBox="0 0 24 24" style="width:44px;height:44px;stroke:var(--danger);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;fill:none;margin-bottom:12px;display:block;margin-inline:auto">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <div style="font-size:15px;font-weight:600;margin-bottom:6px">¿Eliminar encuesta?</div>
            <div style="font-size:13px;color:var(--text-secondary);">
                Se eliminará <strong>${escHtml(nombre)}</strong> junto con todas sus preguntas y respuestas.
                <br>Esta acción no se puede deshacer.
            </div>
        </div>`);
    const btn = document.getElementById('modalSaveBtn');
    if (btn) { btn.textContent = 'Eliminar'; btn.style.background = 'var(--danger)'; }
}

/* ──────────────────────────────────────────────────────────────────
   GUARDAR (llamado desde saveModal en dashboard.html)
   Reemplaza el bloque `else if (m.type === 'encuesta')` del dashboard.
────────────────────────────────────────────────────────────────── */
window.handleSaveEncuesta = async function(m, saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';

    try {
        if (m.action === 'delete') {
            /* Supabase borra en cascada preguntas, envíos y respuestas */
            const { error } = await _encSb().from('encuestas').delete().eq('id', m.id);
            if (error) throw error;
            closeModal();
            showToast('Encuesta eliminada', '#FF453A');
            await loadEncuestas();

        } else {
            const nombre = (document.getElementById('mEncNombre')?.value || '').trim();
            if (!nombre) {
                showToast('El nombre es requerido', '#FF9F0A');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Guardar';
                return;
            }

            const payload = {
                nombre,
                tipo:       document.getElementById('mEncTipo')?.value     || 'Mixta',
                preg_total: parseInt(document.getElementById('mEncPregTotal')?.value) || 5,
                notas:      document.getElementById('mEncNotas')?.value     || null,
                updated_at: new Date().toISOString()
            };

            if (m.action === 'edit') {
                payload.estado = document.getElementById('mEncEstado')?.value || 'Borrador';
                const { error } = await _encSb().from('encuestas').update(payload).eq('id', m.id);
                if (error) throw error;
                showToast('Encuesta actualizada', '#30D158');
            } else {
                payload.estado = 'Borrador';
                const { error } = await _encSb().from('encuestas').insert(payload);
                if (error) throw error;
                showToast('Encuesta creada', '#30D158');
            }

            closeModal();
            await loadEncuestas();
        }
    } catch (err) {
        console.error('[Encuestas] save:', err);
        showToast('Error: ' + (err.message || err), '#FF453A');
        saveBtn.disabled = false;
        saveBtn.textContent = m.action === 'delete' ? 'Eliminar' : 'Guardar';
    }
};
