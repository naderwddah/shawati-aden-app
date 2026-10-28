'use strict';

/**
 * Dashboard data is loaded from four focused endpoints in parallel.
 * An unavailable section never silently becomes a financial zero.
 */
const Dashboard = {
    initialized: false,
    refreshId: 0,
    controllers: {},
    state: { today: '' },

    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.state.today = this.getToday();
        this.setText('currentDateDisplay', this.formatDate(this.state.today, true));

        const refreshButton = document.getElementById('dashboardRefresh');
        refreshButton?.addEventListener('click', () => this.refresh());

        document.querySelector('.dashboard-page')?.addEventListener('click', event => {
            const retryButton = event.target.closest('[data-retry-section]');
            if (retryButton) this.loadSection(retryButton.dataset.retrySection, this.refreshId)
                .then(() => this.setText('dashboardUpdateStatus', 'تم تحديث القسم'))
                .catch(() => this.setText('dashboardUpdateStatus', 'فشل تحديث القسم، أعد المحاولة'));
        });

        this.refresh();
    },

    async refresh() {
        const version = ++this.refreshId;
        this.state.today = this.getToday();
        this.setText('currentDateDisplay', this.formatDate(this.state.today, true));
        Object.values(this.controllers).forEach(controller => controller.abort());
        this.controllers = {};
        this.setRefreshState(true, 'جاري تحديث البيانات...');

        const results = await Promise.allSettled([
            this.loadSection('today', version),
            this.loadSection('upcoming', version),
            this.loadSection('receivables', version),
            this.loadSection('overview', version),
        ]);

        if (version !== this.refreshId) return;
        const failed = results.filter(result => result.status === 'rejected').length;
        const successful = results.length - failed;
        this.setRefreshState(false,
            successful === 0 ? 'تعذر تحديث لوحة التحكم' :
                failed > 0 ? `تحديث جزئي — ${failed} أقسام غير متاحة` :
                    `آخر تحديث ${new Date().toLocaleTimeString('ar-SA-u-ca-gregory', { hour: '2-digit', minute: '2-digit' })}`
        );
    },

    async loadSection(section, version = this.refreshId) {
        const names = ['today', 'upcoming', 'receivables', 'overview'];
        if (!names.includes(section) || version !== this.refreshId) return;

        if (this.controllers[section]) this.controllers[section].abort();
        const controller = new AbortController();
        this.controllers[section] = controller;
        const timeout = setTimeout(() => controller.abort(), 20000);
        this.setSectionLoading(section);

        try {
            if (!window.API || typeof API.request !== 'function') {
                throw new Error('خدمة الاتصال بالخادم غير متاحة');
            }

            const options = {
                signal: controller.signal,
                ...(section === 'receivables' ? {} : { query: { date: this.state.today } }),
            };
            const response = await API.request(`/dashboard/${section}`, options);
            const payload = response?.data;
            if (!this.isValidPayload(section, payload)) {
                throw new Error('استجابة الخادم غير مكتملة');
            }
            if (version !== this.refreshId || controller.signal.aborted) return;
            this[`render${section[0].toUpperCase()}${section.slice(1)}`](payload);
        } catch (error) {
            if (version !== this.refreshId || this.controllers[section] !== controller) return;
            console.error(`Dashboard ${section} error:`, error);
            this.setSectionError(section);
            throw error;
        } finally {
            clearTimeout(timeout);
            if (this.controllers[section] === controller) delete this.controllers[section];
        }
    },

    isValidPayload(section, payload) {
        if (!payload || typeof payload !== 'object') return false;
        const required = {
            today: ['count', 'total_amount', 'bookings'],
            upcoming: ['count', 'items_quantity', 'bookings'],
            receivables: ['count', 'total_amount', 'accounts'],
            overview: ['active_customers', 'suppliers_count', 'items_count', 'customer_payments_today'],
        }[section] || [];
        return required.every(key => {
            if (!(key in payload)) return false;
            if (key === 'bookings' || key === 'accounts') return Array.isArray(payload[key]);
            return payload[key] !== null && payload[key] !== '' && Number.isFinite(Number(payload[key]));
        });
    },

    setSectionLoading(section) {
        const map = {
            today: ['todayCount', 'todayTotal'],
            upcoming: ['upcomingCount', 'upcomingGuests', 'upcomingBadge'],
            receivables: ['receivablesTotal', 'receivablesCount', 'alertBadge'],
            overview: ['todayCollected', 'activeCustomers', 'supplierCount', 'itemCount'],
        };
        (map[section] || []).forEach(id => this.setText(id, '—'));
        const list = { today: 'todayBookingsList', upcoming: 'upcomingBookingsList', receivables: 'paymentAlertsList' }[section];
        if (list) this.setHTML(list, this.messageState('جاري تحميل البيانات...', 'fa-spinner fa-spin'));
    },

    setSectionError(section) {
        const map = {
            today: ['todayCount', 'todayTotal'],
            upcoming: ['upcomingCount', 'upcomingGuests', 'upcomingBadge'],
            receivables: ['receivablesTotal', 'receivablesCount', 'alertBadge'],
            overview: ['todayCollected', 'activeCustomers', 'supplierCount', 'itemCount'],
        };
        (map[section] || []).forEach(id => this.setText(id, '—'));
        const list = { today: 'todayBookingsList', upcoming: 'upcomingBookingsList', receivables: 'paymentAlertsList' }[section];
        if (list) {
            this.setHTML(list, this.messageState('تعذر تحميل البيانات. لم يتم اعتبارها صفرًا.', 'fa-triangle-exclamation', section));
        }
        if (section === 'overview') {
            this.setText('overviewNotice', 'تعذر تحميل النظرة السريعة.');
        }
    },

    renderToday(data) {
        this.setText('todayCount', this.number(data.count));
        this.setText('todayTotal', this.formatMoney(data.total_amount));
        const bookings = Array.isArray(data.bookings) ? data.bookings : [];
        const visible = bookings.slice(0, 10);
        const preview = visible.map(b => this.bookingLink({
            id: b.id,
            name: b.customer_name,
            info: [this.formatTime(b.delivery_time), b.delivery_period].filter(Boolean).join(' · '),
            amount: b.total_amount,
            icon: 'fa-calendar-check',
        })).join('');
        this.setHTML('todayBookingsList', bookings.length
            ? preview + (bookings.length > visible.length
                ? `<div class="dashboard-list-footer">عرض أول ${visible.length} حجوزات من ${bookings.length} — <a href="bookings.html">عرض الكل</a></div>` : '')
            : this.messageState('لا توجد حجوزات اليوم', 'fa-calendar-plus'));
    },

    renderUpcoming(data) {
        this.setText('upcomingCount', this.number(data.count));
        this.setText('upcomingGuests', this.formatQuantity(data.items_quantity));
        this.setText('upcomingBadge', `${this.number(data.count)} حجز`);
        const bookings = Array.isArray(data.bookings) ? data.bookings : [];
        this.setHTML('upcomingBookingsList', bookings.length ? bookings.map(b => this.bookingLink({
            id: b.id,
            name: b.customer_name,
            info: `${this.formatDate(b.event_date)} · ${this.formatTime(b.delivery_time)}`,
            amount: b.total_amount,
            icon: 'fa-calendar',
        })).join('') : this.messageState('لا توجد حجوزات خلال الأيام السبعة القادمة', 'fa-calendar-alt'));
    },

    renderReceivables(data) {
        this.setText('receivablesTotal', this.formatMoney(data.total_amount));
        this.setText('receivablesCount', this.number(data.count));
        this.setText('alertBadge', this.number(data.count));
        const accounts = Array.isArray(data.accounts) ? data.accounts : [];
        this.setHTML('paymentAlertsList', accounts.length ? accounts.map(a => {
            const id = encodeURIComponent(String(a.customer_id ?? ''));
            return `<a class="dashboard-list-item" href="customer-view.html?id=${this.escape(id)}">
                <div class="dashboard-list-icon"><i class="fas fa-money-bill-wave"></i></div>
                <div class="dashboard-list-content">
                    <div class="dashboard-list-title">${this.escape(a.name || 'عميل')}</div>
                    <div class="dashboard-list-meta">${this.escape(a.phone || '')}</div>
                </div>
                <div class="dashboard-list-value">${this.escape(this.formatMoney(a.balance))}</div>
            </a>`;
        }).join('') : this.messageState('لا توجد مبالغ مستحقة على العملاء', 'fa-check-circle'));
    },

    renderOverview(data) {
        this.setText('todayCollected', this.formatMoney(data.customer_payments_today));
        this.setText('activeCustomers', this.number(data.active_customers));
        this.setText('supplierCount', this.number(data.suppliers_count));
        this.setText('itemCount', this.number(data.items_count));
        this.setText('overviewNotice', '');
    },

    bookingLink(b) {
        const id = encodeURIComponent(String(b.id ?? ''));
        return `<a class="dashboard-list-item" href="booking-form.html?id=${this.escape(id)}">
            <div class="dashboard-list-icon"><i class="fas ${this.escape(b.icon)}"></i></div>
            <div class="dashboard-list-content">
                <div class="dashboard-list-title">${this.escape(b.name || 'عميل')}</div>
                <div class="dashboard-list-meta">${this.escape(b.info || '—')}</div>
            </div>
            <div class="dashboard-list-value">${this.escape(this.formatMoney(b.amount))}</div>
        </a>`;
    },

    messageState(message, icon, retrySection = '') {
        return `<div class="empty-state-compact" role="status">
            <i class="fas ${this.escape(icon)}" aria-hidden="true"></i>
            <span>${this.escape(message)}</span>
            ${retrySection ? `<button class="dashboard-retry" type="button" data-retry-section="${this.escape(retrySection)}">إعادة المحاولة</button>` : ''}
        </div>`;
    },

    setRefreshState(loading, message) {
        const button = document.getElementById('dashboardRefresh');
        if (button) {
            button.disabled = loading;
            button.setAttribute('aria-busy', String(loading));
        }
        this.setText('dashboardUpdateStatus', message);
    },

    getToday() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },

    formatDate(value, full = false) {
        const iso = String(value ?? '').slice(0, 10);
        const [y, m, d] = iso.split('-').map(Number);
        if (!y || !m || !d) return '—';
        const date = new Date(y, m - 1, d);
        return date.toLocaleDateString('ar-SA-u-ca-gregory', full
            ? { year: 'numeric', month: 'long', day: 'numeric' }
            : { month: 'short', day: 'numeric' });
    },

    formatTime(value) {
        if (!value) return '';
        const match = String(value).match(/^(\d{1,2}):(\d{2})/);
        if (!match) return String(value);
        const hours = Number(match[1]);
        return `${String(hours % 12 || 12)}:${match[2]} ${hours < 12 ? 'ص' : 'م'}`;
    },

    number(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    },

    formatMoney(value) {
        return `${this.number(value).toLocaleString('ar-SA', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ر.س`;
    },

    formatQuantity(value) {
        return this.number(value).toLocaleString('ar-SA', { maximumFractionDigits: 2 });
    },

    escape(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },

    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    },

    setHTML(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = value;
    },
};

// Wait for Layout's authentication check; avoid firing protected API calls pre-login.
document.addEventListener('layout:ready', () => Dashboard.init());
if (window.layoutReady === true) Dashboard.init();
