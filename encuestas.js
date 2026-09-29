/* ═══════════════════════════════════════════════════════
   encuestas.js — Módulo Encuestas
   Extraído de dashboard.html
═══════════════════════════════════════════════════════ */

/* Dependencias globales:
   _encuestas, _modalMode, openModal, closeModal,
   showToast, escHtml, v, _onApiError, window.api
*/

        function loadEncuestas() {
            window.api
                .withSuccessHandler(function (r) {
                    if (!r.ok) { showToast('Error encuestas: ' + (r.error || 'sin datos'), '#FF453A'); return; }
                    _encuestas = r.data || [];
                    renderEncuestas();
                    document.getElementById('enc-env').textContent = (r.data || []).reduce((s, e) => s + Number(e.totalEnviadas || 0), 0);
                })
                .withFailureHandler(function (err) { _onApiError('encuestas', err); })
                .getEncuestas();
        }

        /* ═══════════════════════════════════════════════════════
           RENDER – ENCUESTAS
        ═══════════════════════════════════════════════════════ */
        function renderEncuestas() {
            const grid = document.getElementById('surveyGrid');
            const cards = _encuestas.map(e => {
                const pct = Number(e.totalEnviadas) ? Math.round(Number(e.respuestas) / Number(e.totalEnviadas) * 100) : 0;
                const pConf = Number(e.pregConf || 0), pTot = Number(e.pregTotal || 12);
                const pPct = pTot ? Math.round(pConf / pTot * 100) : 0;
                const estadoTag = e.estado === 'Activa' ? '<span class="tag tag-success">Activa</span>' : e.estado === 'Borrador' ? '<span class="tag tag-warning">Borrador</span>' : '<span class="tag tag-gray">' + escHtml(e.estado) + '</span>';
                const fecha = e.fechaEnvio ? new Date(e.fechaEnvio).toLocaleDateString('es-GT', {day: 'numeric', month: 'short', year: 'numeric'}) : '—';
                const activos = e.estado === 'Activa';
                return `<div class="survey-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div class="survey-name">${escHtml(e.nombre)}</div>${estadoTag}
      </div>
      <div class="survey-meta">${activos ? `Enviada el ${fecha} · ${e.respuestas} respuestas de ${e.totalEnviadas}` : e.estado === 'Borrador' ? `Creada el ${fecha} · Sin enviar aún` : fecha}</div>
      <div class="survey-stat">
        <span class="survey-stat-label">${activos ? 'Tasa de respuesta' : 'Preguntas configuradas'}</span>
        <span class="survey-stat-value">${activos ? pct + '%' : pConf + ' / ' + pTot}</span>
      </div>
      <div class="progress-bar" style="margin-bottom:14px;height:6px;">
        <div class="progress-fill ${activos ? '' : 'mid'}" style="width:${activos ? pct : pPct}%"></div>
      </div>
      ${e.estado === 'Borrador' ? `<div style="background:var(--warning-bg);border-radius:9px;padding:10px 12px;font-size:12.5px;color:#a06000;line-height:1.4;">Completa las preguntas restantes antes de enviar. Faltan ${pTot - pConf} preguntas.</div>` : ''}
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="topbar-btn" style="height:30px;font-size:12px;" onclick="editEncuesta('${e.id}')">Editar</button>
        <button class="btn-danger-sm" style="height:30px;" onclick="confirmDeleteEncuesta('${e.id}','${escHtml(e.nombre)}')">Eliminar</button>
      </div>
    </div>`;
            });

            cards.push(`<div class="survey-card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:220px;border-style:dashed;cursor:pointer;background:#FAFAFA;" onclick="newEncuesta()">
    <div style="width:44px;height:44px;border-radius:50%;background:var(--accent-bg);display:flex;align-items:center;justify-content:center;margin-bottom:12px;">
      <svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--accent);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </div>
    <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Nueva encuesta</div>
    <div style="font-size:12.5px;color:var(--text-secondary);">Crea y envía en minutos</div>
  </div>`);

            grid.innerHTML = cards.join('');
        }

        /* ═══════════════════════════════════════════════════════
           MODAL – ENCUESTAS
        ═══════════════════════════════════════════════════════ */
        function newEncuesta() {
            _modalMode = {type: 'encuesta', action: 'add', id: null};
            openModal('Nueva encuesta', `
    <div class="form-field"><label class="form-label">NOMBRE DE LA ENCUESTA *</label><input class="form-input" id="mEncNombre" placeholder="Ej. NPS Q4 2026" required/></div>
    <div class="form-field"><label class="form-label">TIPO</label>
      <select class="form-select" id="mEncTipo"><option>NPS</option><option>Escala</option><option>Mixta</option><option>Opción múltiple</option></select>
    </div>
    <div class="form-field"><label class="form-label">TOTAL DE PREGUNTAS</label><input class="form-input" id="mEncPregTotal" type="number" min="1" value="12"/></div>
  `);
        }

        function editEncuesta(id) {
            const e = _encuestas.find(x => String(x.id) === String(id));
            if (!e) return;
            _modalMode = {type: 'encuesta', action: 'edit', id};
            openModal('Editar encuesta', `
    <div class="form-field"><label class="form-label">NOMBRE *</label><input class="form-input" id="mEncNombre" value="${escHtml(e.nombre)}" required/></div>
    <div class="form-field"><label class="form-label">ESTADO</label>
      <select class="form-select" id="mEncEstado">
        ${['Borrador', 'Activa', 'Cerrada'].map(s => `<option${s === e.estado ? ' selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-field"><label class="form-label">TIPO</label>
      <select class="form-select" id="mEncTipo">
        ${['NPS', 'Escala', 'Mixta', 'Opción múltiple'].map(t => `<option${t === e.tipo ? ' selected' : ''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="form-field"><label class="form-label">TOTAL ENVIADAS</label><input class="form-input" id="mEncEnv" type="number" min="0" value="${e.totalEnviadas}"/></div>
    <div class="form-field"><label class="form-label">RESPUESTAS RECIBIDAS</label><input class="form-input" id="mEncResp" type="number" min="0" value="${e.respuestas}"/></div>
    <div class="form-field"><label class="form-label">PREGUNTAS CONFIGURADAS</label><input class="form-input" id="mEncConf" type="number" min="0" value="${e.pregConf}"/></div>
    <div class="form-field"><label class="form-label">TOTAL PREGUNTAS</label><input class="form-input" id="mEncPregTotal" type="number" min="1" value="${e.pregTotal}"/></div>
  `);
        }

        function confirmDeleteEncuesta(id, nombre) {
            _modalMode = {type: 'encuesta', action: 'delete', id};
            openModal('Eliminar encuesta', `<div style="text-align:center;padding:10px 0">
    <svg viewBox="0 0 24 24" style="width:44px;height:44px;stroke:var(--danger);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;fill:none;margin-bottom:12px;display:block;margin-inline:auto"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    <div style="font-size:15px;font-weight:600;margin-bottom:6px">¿Eliminar encuesta?</div>
    <div style="font-size:13px;color:var(--text-secondary)">Se eliminará <strong>${escHtml(nombre)}</strong> y sus datos.<br>Esta acción no se puede deshacer.</div>
  </div>`);
            document.getElementById('modalSaveBtn').textContent = 'Eliminar';
            document.getElementById('modalSaveBtn').style.background = 'var(--danger)';
        }

