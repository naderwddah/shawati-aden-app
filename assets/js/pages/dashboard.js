const Dashboard = {
    state: {
        today: '',
        bookings: [],
        customers: [],
        suppliers: [],
        items: [],
        accounts: []
    },

    async init() {
        try {
            if (!window.API) {
                throw new Error('ملف API غير محمل');
            }

            this.state.today = this.getToday();

            const [
                bookings,
                customers,
                suppliers,
                items
            ] = await Promise.all([
                API.getBookings(),
                API.getCustomers(),
                API.getSuppliers(),
                API.getItems()
            ]);

            this.state.bookings = this.normalizeArray(bookings);
            this.state.customers = this.normalizeArray(customers);
            this.state.suppliers = this.normalizeArray(suppliers);
            this.state.items = this.normalizeArray(items);

            await this.loadAccounts();

            this.render();
        } catch (error) {
            console.error('Dashboard error:', error);

            this.showError(
                error?.message || 'تعذر تحميل بيانات لوحة التحكم'
            );
        } finally {
            this.hideLoading();
        }
    },

    async loadAccounts() {
        const customers = this.state.customers;

        if (!customers.length) {
            this.state.accounts = [];
            return;
        }

        try {
            const accountsResponse = await API.getCustomerAccounts();

            const accounts = this.normalizeArray(accountsResponse);

            this.state.accounts = accounts
                .map(entry => {
                    const account = entry?.account || entry || {};
                    const customerData = entry?.customer || null;

                    const customerId =
                        customerData?.id ??
                        entry?.customer_id ??
                        entry?.customerId ??
                        account?.customer_id ??
                        account?.customerId;

                    const customer = customers.find(
                        item =>
                            String(item.id) ===
                            String(customerId)
                    );

                    return {
                        customer:
                            customerData ||
                            customer ||
                            {},
                        account
                    };
                })
                .filter(entry => entry.customer?.id);
        } catch (error) {
            console.error('Customer accounts error:', error);

            this.state.accounts = [];
        }
    },

    render() {
        const today = this.state.today;

        const todayBookings = this.state.bookings
            .filter(booking => {
                return this.dateOnly(
                    booking.eventDate ?? booking.event_date
                ) === today;
            })
            .filter(booking => this.isActiveBooking(booking));

        const upcomingBookings = this.state.bookings
            .filter(booking => {
                const date = this.dateOnly(
                    booking.eventDate ?? booking.event_date
                );

                return (
                    date >= today &&
                    date <= this.addDays(today, 7) &&
                    this.isActiveBooking(booking)
                );
            })
            .sort((a, b) => {
                return this.dateOnly(
                    a.eventDate ?? a.event_date
                ).localeCompare(
                    this.dateOnly(
                        b.eventDate ?? b.event_date
                    )
                );
            });

        const receivables = this.getReceivables();

        this.setText(
            'todayCount',
            todayBookings.length
        );

        this.setText(
            'todayTotal',
            this.formatMoney(
                todayBookings.reduce(
                    (sum, booking) =>
                        sum + this.number(
                            booking.totalAmount ??
                            booking.total_amount
                        ),
                    0
                )
            )
        );

        this.setText(
            'upcomingCount',
            upcomingBookings.length
        );

        this.setText(
            'upcomingGuests',
            upcomingBookings.reduce(
                (sum, booking) =>
                    sum + this.getBookingQuantity(booking),
                0
            )
        );

        this.setText(
            'receivablesTotal',
            this.formatMoney(receivables.total)
        );

        this.setText(
            'receivablesCount',
            receivables.count
        );

        this.setText(
            'todayRevenue',
            this.formatMoney(
                this.getTodayRevenue(todayBookings)
            )
        );

        this.setText(
            'activeCustomers',
            this.state.customers.filter(customer =>
                customer.isActive !== false &&
                customer.is_active !== false &&
                customer.isActive !== 0 &&
                customer.is_active !== 0
            ).length
        );

        this.setText(
            'supplierCount',
            this.state.suppliers.length
        );

        this.setText(
            'itemCount',
            this.state.items.length
        );

        this.renderTodayBookings(todayBookings);
        this.renderUpcomingBookings(upcomingBookings);
        this.renderPaymentAlerts(receivables);
    },

    getReceivables() {
        let total = 0;
        let count = 0;

        const accounts = this.state.accounts;

        accounts.forEach(entry => {
            const account = entry.account || {};

            const balance = this.number(
                account.balance ??
                account.balanceAmount ??
                account.balance_amount ??
                0
            );

            const balanceType = String(
                account.balanceType ??
                account.balance_type ??
                ''
            ).toLowerCase();

            const due =
                balance > 0 &&
                (
                    !balanceType ||
                    balanceType === 'due' ||
                    balanceType === 'debit' ||
                    balanceType === 'مستحق'
                );

            if (due) {
                total += balance;
                count++;
            }
        });

        return {
            total,
            count,
            accounts: accounts.filter(entry => {
                const account = entry.account || {};

                const balance = this.number(
                    account.balance ??
                    account.balanceAmount ??
                    account.balance_amount ??
                    0
                );

                const balanceType = String(
                    account.balanceType ??
                    account.balance_type ??
                    ''
                ).toLowerCase();

                return (
                    balance > 0 &&
                    (
                        !balanceType ||
                        balanceType === 'due' ||
                        balanceType === 'debit' ||
                        balanceType === 'مستحق'
                    )
                );
            })
        };
    },

    getTodayRevenue(todayBookings) {
        return todayBookings.reduce(
            (sum, booking) =>
                sum + this.number(
                    booking.totalAmount ??
                    booking.total_amount
                ),
            0
        );
    },

    renderTodayBookings(bookings) {
        const container =
            document.getElementById('todayBookingsList');

        if (!container) return;

        if (!bookings.length) {
            container.innerHTML = this.emptyState(
                'لا توجد حجوزات اليوم'
            );
            return;
        }

        const sorted = [...bookings].sort((a, b) => {
            const timeA =
                a.deliveryTime ??
                a.delivery_time ??
                '';

            const timeB =
                b.deliveryTime ??
                b.delivery_time ??
                '';

            return String(timeA).localeCompare(
                String(timeB)
            );
        });

        container.innerHTML = sorted.map(booking => {
            const id = booking.id;

            const customer = this.getCustomerName(booking);

            const time =
                booking.deliveryTime ??
                booking.delivery_time ??
                '—';

            const period =
                booking.deliveryPeriod ??
                booking.delivery_period ??
                '';

            const total =
                booking.totalAmount ??
                booking.total_amount ??
                0;

            return `
                <div class="dashboard-list-item"
                     data-booking-id="${this.escape(id)}">
                    <div class="dashboard-list-icon">
                        <i class="fas fa-calendar-check"></i>
                    </div>

                    <div class="dashboard-list-content">
                        <div class="dashboard-list-title">
                            ${this.escape(customer)}
                        </div>

                        <div class="dashboard-list-meta">
                            ${this.escape(time)}
                            ${period ? ` · ${this.escape(period)}` : ''}
                        </div>
                    </div>

                    <div class="dashboard-list-value">
                        ${this.escape(this.formatMoney(total))}
                    </div>
                </div>
            `;
        }).join('');

        this.bindBookingLinks(container);
    },

    renderUpcomingBookings(bookings) {
        const container =
            document.getElementById('upcomingBookingsList');

        const badge =
            document.getElementById('upcomingBadge');

        if (badge) {
            badge.textContent = `${bookings.length} حجز`;
        }

        if (!container) return;

        if (!bookings.length) {
            container.innerHTML = this.emptyState(
                'لا توجد حجوزات قادمة'
            );
            return;
        }

        container.innerHTML = bookings
            .slice(0, 10)
            .map(booking => {
                const id = booking.id;

                const customer =
                    this.getCustomerName(booking);

                const date =
                    booking.eventDate ??
                    booking.event_date;

                const time =
                    booking.deliveryTime ??
                    booking.delivery_time ??
                    '—';

                const total =
                    booking.totalAmount ??
                    booking.total_amount ??
                    0;

                return `
                    <div class="dashboard-list-item"
                         data-booking-id="${this.escape(id)}">

                        <div class="dashboard-list-icon">
                            <i class="fas fa-calendar"></i>
                        </div>

                        <div class="dashboard-list-content">
                            <div class="dashboard-list-title">
                                ${this.escape(customer)}
                            </div>

                            <div class="dashboard-list-meta">
                                ${this.escape(
                                    this.formatDate(date)
                                )}
                                ·
                                ${this.escape(time)}
                            </div>
                        </div>

                        <div class="dashboard-list-value">
                            ${this.escape(
                                this.formatMoney(total)
                            )}
                        </div>
                    </div>
                `;
            })
            .join('');

        this.bindBookingLinks(container);
    },

    renderPaymentAlerts(receivables) {
        const container =
            document.getElementById('paymentAlertsList');

        const badge =
            document.getElementById('alertBadge');

        if (!container) return;

        if (badge) {
            badge.textContent = receivables.count;
        }

        if (!receivables.accounts.length) {
            container.innerHTML = this.emptyState(
                'لا توجد مستحقات مالية'
            );
            return;
        }

        container.innerHTML =
            receivables.accounts
                .slice(0, 10)
                .map(entry => {
                    const customer =
                        entry.customer || {};

                    const account =
                        entry.account || {};

                    const balance =
                        this.number(
                            account.balance ??
                            account.balanceAmount ??
                            account.balance_amount ??
                            0
                        );

                    return `
                        <div class="dashboard-list-item"
                             data-customer-id="${this.escape(customer.id)}">

                            <div class="dashboard-list-icon">
                                <i class="fas fa-money-bill-wave"></i>
                            </div>

                            <div class="dashboard-list-content">
                                <div class="dashboard-list-title">
                                    ${this.escape(
                                        customer.name || 'عميل'
                                    )}
                                </div>

                                <div class="dashboard-list-meta">
                                    ${this.escape(
                                        customer.phone || ''
                                    )}
                                </div>
                            </div>

                            <div class="dashboard-list-value">
                                ${this.escape(
                                    this.formatMoney(balance)
                                )}
                            </div>
                        </div>
                    `;
                })
                .join('');

        container
            .querySelectorAll('[data-customer-id]')
            .forEach(element => {
                element.addEventListener('click', () => {
                    const id =
                        element.dataset.customerId;

                    if (id) {
                        window.location.href =
                            `customer-view.html?id=${encodeURIComponent(id)}`;
                    }
                });
            });
    },

    bindBookingLinks(container) {
        container
            .querySelectorAll('[data-booking-id]')
            .forEach(element => {
                element.addEventListener('click', () => {
                    const id =
                        element.dataset.bookingId;

                    if (id) {
                        window.location.href =
                            `booking-form.html?id=${encodeURIComponent(id)}`;
                    }
                });
            });
    },

    getCustomerName(booking) {
        if (
            booking.customer &&
            booking.customer.name
        ) {
            return booking.customer.name;
        }

        if (booking.customerName) {
            return booking.customerName;
        }

        if (booking.customer_name) {
            return booking.customer_name;
        }

        const customerId =
            booking.customerId ??
            booking.customer_id;

        const customer =
            this.state.customers.find(
                item =>
                    String(item.id) ===
                    String(customerId)
            );

        return customer?.name || 'عميل';
    },

    getBookingQuantity(booking) {
        const items = booking.items;

        if (Array.isArray(items)) {
            return items.reduce(
                (sum, item) =>
                    sum + this.number(
                        item.quantity
                    ),
                0
            );
        }

        return this.number(
            booking.quantity ??
            booking.guests ??
            0
        );
    },

    isActiveBooking(booking) {
        const status = String(
            booking.status || ''
        ).toLowerCase();

        return ![
            'cancelled',
            'canceled',
            'ملغي'
        ].includes(status);
    },

    getToday() {
        const date = new Date();

        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1
            ).padStart(2, '0');

        const day =
            String(
                date.getDate()
            ).padStart(2, '0');

        return `${year}-${month}-${day}`;
    },

    addDays(dateString, days) {
        const parts =
            dateString.split('-').map(Number);

        const date = new Date(
            parts[0],
            parts[1] - 1,
            parts[2]
        );

        date.setDate(
            date.getDate() + days
        );

        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1
            ).padStart(2, '0');

        const day =
            String(
                date.getDate()
            ).padStart(2, '0');

        return `${year}-${month}-${day}`;
    },

    dateOnly(value) {
        if (!value) return '';

        return String(value).slice(0, 10);
    },

    formatDate(value) {
        if (!value) return '—';

        const date =
            new Date(`${this.dateOnly(value)}T00:00:00`);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString(
            'ar-SA',
            {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            }
        );
    },

    formatMoney(value) {
        return `${this.number(value).toLocaleString(
            'ar-SA',
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        )} ر.س`;
    },

    normalizeArray(data) {
        if (Array.isArray(data)) {
            return data;
        }

        if (
            data &&
            Array.isArray(data.data)
        ) {
            return data.data;
        }

        return [];
    },

    number(value) {
        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    },

    setText(id, value) {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    },

    emptyState(message) {
        return `
            <div class="empty-state-compact">
                <i class="fas fa-inbox"></i>
                <span>${this.escape(message)}</span>
            </div>
        `;
    },

    showError(error) {
        if (
            typeof showToast === 'function'
        ) {
            showToast(
                error,
                'error'
            );
        }
    },

    hideLoading() {
        const loading =
            document.getElementById(
                'loadingScreen'
            );

        if (!loading) return;

        loading.style.opacity = '0';
        loading.style.pointerEvents = 'none';

        setTimeout(() => {
            loading.style.display = 'none';
        }, 250);
    },

    escape(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

document.addEventListener(
    'DOMContentLoaded',
    () => {
        Dashboard.init();
    }
);