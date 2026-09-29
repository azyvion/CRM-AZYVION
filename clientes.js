/* ═══════════════════════════════════════════════════════
   clientes.js — Carga, render, modales de Clientes
   Extraído de dashboard.html
═══════════════════════════════════════════════════════ */

        function loadClientes() {
            window.api
                .withSuccessHandler(function (r) {
                    if (!r.ok) { showToast('Error clientes: ' + (r.error || 'sin datos'), '#FF453A'); return; }
                    _clientes = r.data || [];
                    renderClientes(_filtroCliActual);
                    renderOvClientes();
                    cotLlenarSelectClientes();
                })
                .withFailureHandler(function (err) { _onApiError('clientes', err); })
                .getClientes();
        }


        /* ═══════════════════════════════════════════════════════
           RENDER – OVERVIEW
        ═══════════════════════════════════════════════════════ */
        function renderOvClientes() {
            renderOvTopClientes();
            const rows = _clientes.slice(0, 4);
            var el = document.getElementById('ovClientesTbody'); if (!el) return; el.innerHTML = rows.length
                ? rows.map(c => `<tr>
        <td><div class="client-name"><div class="mini-avatar" style="background:${c.color}">${initials(c.nombre)}</div>${escHtml(c.nombre)}</div></td>
        <td>${tagSegmento(c.segmento)}</td>
        <td>${tagEstado(c.estado)}</td>
        <td>Q ${Number(c.valorTotal).toLocaleString()}</td>
      </tr>`).join('')
                : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">Sin clientes</td></tr>';
        }

        function renderOvStock() {
            const criticos = _inventario.filter(i => i.estado === 'Crítico' || i.estado === 'Bajo').slice(0, 4);
            document.getElementById('ovStockTbody').innerHTML = criticos.length
                ? criticos.map(i => {
                    const pct = Math.round(Number(i.unidades) / Math.max(Number(i.stockMax), 1) * 100);
                    const cls = i.estado === 'Crítico' ? 'low' : 'mid';
                    return `<tr>
          <td>${escHtml(i.producto)}</td>
          <td><div class="progress-wrap"><div class="progress-bar"><div class="progress-fill ${cls}" style="width:${Math.max(pct, 2)}%"></div></div><span class="progress-val">${i.unidades}</span></div></td>
          <td>${tagEstadoInv(i.estado)}</td>
        </tr>`;
                }).join('')
                : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px">✅ Sin stock crítico</td></tr>';
        }

        /* ═══════════════════════════════════════════════════════

           RENDER – CLIENTES
        ═══════════════════════════════════════════════════════ */
        function renderClientes(filtro) {
            _filtroCliActual = filtro;
            let data = filtro === 'Todos' ? _clientes.slice() : _clientes.filter(c => c.estado === filtro);

            const seg = valOf('cliFiltroSeg');
            if (seg) data = data.filter(c => c.segmento === seg);

            const q = document.getElementById('searchInput').value.toLowerCase();
            if (q && _currentPage === 'clientes') {
                data = data.filter(c => [c.nombre, c.empresa, c.correo, c.telefono, c.direccion]
                    .some(f => String(f || '').toLowerCase().includes(q)));
            }

            const orden = valOf('cliOrden') || 'nombre';
            data.sort((a, b) => {
                if (orden === 'valor') return Number(b.valorTotal || 0) - Number(a.valorTotal || 0);
                if (orden === 'reciente') return new Date(b.fechaReg || 0) - new Date(a.fechaReg || 0);
                return String(a.nombre).localeCompare(String(b.nombre), 'es');
            });

            const suma = data.reduce((s, c) => s + Number(c.valorTotal || 0), 0);
            const admin = esAdmin();
            document.getElementById('cliFoot').innerHTML =
                `<span><strong>${data.length}</strong> de ${_clientes.length} clientes</span>` +
                `<span>Valor sumado: <strong>Q ${suma.toLocaleString()}</strong></span>` +
                (admin ? '' : '<span style="color:var(--text-muted)">Eliminar requiere rol Admin</span>');

            /* Guardar dataset filtrado, resetear a página 0 y renderizar */
            _cliDataPaged = data;
            _cliPage = 0;
            _renderCliPagedData();
        }

        function exportarClientes() {
            const filas = _clientes.map(c => ({
                ID: c.id, Nombre: c.nombre, Empresa: c.empresa, Segmento: c.segmento,
                Correo: c.correo, Telefono: c.telefono, Direccion: c.direccion,
                Estado: c.estado, ValorTotal: c.valorTotal, FechaRegistro: fechaCorta(c.fechaReg)
            }));
            descargarCSV(filas, 'clientes');
        }

        function filtrarClientes(filtro, el) {
            el.closest('.filter-tabs').querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
            renderClientes(filtro);
        }


        /* ═══════════════════════════════════════════════════════
           MODAL – CLIENTES
        ═══════════════════════════════════════════════════════ */
        function newCliente() {
            _modalMode = {type: 'cliente', action: 'add', id: null};
            openModal('Nuevo cliente', `
    <div class="form-field"><label class="form-label">NOMBRE COMPLETO *</label><input class="form-input" id="mNombre" placeholder="Ej. Ana Pérez" required/></div>
    <div class="form-field"><label class="form-label">EMPRESA</label><input class="form-input" id="mEmpresa" placeholder="Ej. AP Consulting"/></div>
    <div class="form-field"><label class="form-label">SEGMENTO</label>
      <select class="form-select" id="mSegmento"><option>Estándar</option><option>Premium</option><option>Corporativo</option></select>
    </div>
    <div class="form-row">
      <div class="form-field"><label class="form-label">CORREO</label><input class="form-input" id="mCorreo" type="email" placeholder="correo@empresa.com"/></div>
      <div class="form-field"><label class="form-label">TELÉFONO</label><input class="form-input" id="mTelefono" placeholder="+502 0000 0000"/></div>
    </div>
    <div class="form-field"><label class="form-label">DIRECCIÓN</label><input class="form-input" id="mDireccion" placeholder="Zona, calle, referencia"/></div>
    <div class="form-field"><label class="form-label">ESTADO</label>
      <select class="form-select" id="mEstado"><option>Activo</option><option>Pendiente</option><option>Inactivo</option></select>
    </div>
    <div class="form-field"><label class="form-label">VALOR TOTAL (Q)</label><input class="form-input" id="mValor" type="number" min="0" placeholder="0"/></div>
  `);
        }

        function editCliente(id) {
            const c = _clientes.find(x => String(x.id) === String(id));
            if (!c) return;
            _modalMode = {type: 'cliente', action: 'edit', id};
            openModal('Editar cliente', `
    <div class="form-field"><label class="form-label">NOMBRE COMPLETO *</label><input class="form-input" id="mNombre" value="${escHtml(c.nombre)}" required/></div>
    <div class="form-field"><label class="form-label">EMPRESA</label><input class="form-input" id="mEmpresa" value="${escHtml(c.empresa)}"/></div>
    <div class="form-field"><label class="form-label">SEGMENTO</label>
      <select class="form-select" id="mSegmento">
        ${['Estándar', 'Premium', 'Corporativo'].map(s => `<option${s === c.segmento ? ' selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-field"><label class="form-label">CORREO</label><input class="form-input" id="mCorreo" type="email" value="${escAttr(c.correo)}"/></div>
      <div class="form-field"><label class="form-label">TELÉFONO</label><input class="form-input" id="mTelefono" value="${escAttr(c.telefono)}"/></div>
    </div>
    <div class="form-field"><label class="form-label">DIRECCIÓN</label><input class="form-input" id="mDireccion" value="${escAttr(c.direccion)}"/></div>
    <div class="form-field"><label class="form-label">ESTADO</label>
      <select class="form-select" id="mEstado">
        ${['Activo', 'Pendiente', 'Inactivo'].map(s => `<option${s === c.estado ? ' selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-field"><label class="form-label">VALOR TOTAL (Q)</label><input class="form-input" id="mValor" type="number" min="0" value="${c.valorTotal}"/></div>
  `);
        }

        function confirmDeleteCliente(id, nombre) {
            if (!esAdmin()) {showToast('Solo un administrador puede eliminar registros', '#FF9F0A'); return;}
            _modalMode = {type: 'cliente', action: 'delete', id};
            openModal('Eliminar cliente', `<div style="text-align:center;padding:10px 0">
    <svg viewBox="0 0 24 24" style="width:44px;height:44px;stroke:var(--danger);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;fill:none;margin-bottom:12px;display:block;margin-inline:auto"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    <div style="font-size:15px;font-weight:600;margin-bottom:6px">¿Eliminar cliente?</div>
    <div style="font-size:13px;color:var(--text-secondary)">Se eliminará <strong>${escHtml(nombre)}</strong> permanentemente.<br>Esta acción no se puede deshacer.</div>
  </div>`);
            document.getElementById('modalSaveBtn').textContent = 'Eliminar';
            document.getElementById('modalSaveBtn').style.background = 'var(--danger)';
        }

