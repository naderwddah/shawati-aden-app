(function () {
  'use strict';

  let customerId = 0;
  let currentCustomer = null;
  let currentBookings = [];
  let currentPayments = [];
  let paymentMethods = [];
  let allItems = [];
  let editingBookingId = null;
  let saving = false;

  const container = document.getElementById('customerViewContent');
  const fab = document.getElementById('fab');

  function toast(message, type = 'info') {
    if (window.Layout && typeof Layout.showToast === 'function') {
      Layout.showToast(message, type);
    } else {
      alert(message);
    }
  }

  function confirmAction(options) {
    if (window.Layout && typeof Layout.showConfirm === 'function') {
      Layout.showConfirm(options);
    } else if (confirm(options.message || 'هل أنت متأكد؟')) {
      options.onConfirm && options.onConfirm();
    }
  }

  function money(value) {
    const amount = Number(value) || 0;

    if (window.API && typeof API.formatCurrency === 'function') {
      return API.formatCurrency(amount);
    }

    return amount.toLocaleString('ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ر.س';
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char]));
  }

  function initials(name) {
    return String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word[0])
      .join('')
      .slice(0, 2) || 'ع';
  }

  function dateOnly(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  function nowDate() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function nowDateTime() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function normalizeResponse(value) {
    if (
      value &&
      typeof value === 'object' &&
      Object.prototype.hasOwnProperty.call(value, 'data')
    ) {
      return value.data;
    }

    return value;
  }

  async function apiCall(names, ...args) {
    for (const name of names) {
      if (window.API && typeof window.API[name] === 'function') {
        return normalizeResponse(await window.API[name](...args));
      }
    }

    throw new Error('دالة API المطلوبة غير موجودة');
  }

  function accountData() {
    const account = currentCustomer?.account || {};

    return {
      totalInvoices: Number(
        account.total_invoices ??
        account.totalInvoices ??
        0
      ),
      totalPaid: Number(
        account.total_paid ??
        account.totalPaid ??
        0
      ),
      balance: Number(
        account.balance ??
        account.total_remaining ??
        account.totalRemaining ??
        0
      ),
      balanceType:
        account.balance_type ??
        account.balanceType ??
        ''
    };
  }

  function statusText(status) {
    return {
      new: 'جديد',
      confirmed: 'مؤكد',
      completed: 'مكتمل',
      cancelled: 'ملغي'
    }[status] || status || 'جديد';
  }

  function statusClass(status) {
    return `badge-status badge-${
      ['new', 'confirmed', 'completed', 'cancelled'].includes(status)
        ? status
        : 'new'
    }`;
  }

  function openModal() {
    const modal = document.getElementById('transactionModal');

    if (!modal) return;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = document.getElementById('transactionModal');

    if (modal) {
      modal.classList.remove('active');
    }

    document.body.style.overflow = '';
  }

  function empty(title, message = '') {
    return `
      <div class="empty-state">
        <i class="fas fa-folder-open"></i>
        <h4>${esc(title)}</h4>
        ${message ? `<p>${esc(message)}</p>` : ''}
      </div>
    `;
  }

  async function loadData() {
    if (!window.API) {
      setTimeout(loadData, 200);
      return;
    }

    try {
      const customer = await apiCall(['getCustomer'], customerId);

      if (!customer) {
        renderFailure(
          'العميل غير موجود',
          'لم يتم العثور على العميل.'
        );
        return;
      }

      currentCustomer = customer;

      const results = await Promise.allSettled([
        apiCall(['getBookings'], { customer_id: customerId }),
        apiCall(['getCustomerPayments'], { customer_id: customerId }),
        apiCall(['getCustomerAccount'], customerId),
        apiCall(['getCustomerStatement'], customerId),
        apiCall(['getItems']),
        apiCall(['getPaymentMethods'])
      ]);

      const bookingsResult =
        results[0].status === 'fulfilled'
          ? results[0].value
          : null;

      const paymentsResult =
        results[1].status === 'fulfilled'
          ? results[1].value
          : null;

      const accountResult =
        results[2].status === 'fulfilled'
          ? results[2].value
          : null;

      const statementResult =
        results[3].status === 'fulfilled'
          ? results[3].value
          : null;

      const itemsResult =
        results[4].status === 'fulfilled'
          ? results[4].value
          : null;

      const methodsResult =
        results[5].status === 'fulfilled'
          ? results[5].value
          : null;

      if (itemsResult) {
        allItems = Array.isArray(itemsResult)
          ? itemsResult
          : itemsResult?.data || [];
      }

      if (methodsResult) {
        paymentMethods = Array.isArray(methodsResult)
          ? methodsResult
          : methodsResult?.data || [];
      }

      const customerBookings = Array.isArray(customer.bookings)
        ? customer.bookings
        : [];

      const customerPayments = Array.isArray(customer.payments)
        ? customer.payments
        : [];

      currentBookings = Array.isArray(bookingsResult)
        ? bookingsResult
        : bookingsResult?.data || customerBookings;

      currentPayments = Array.isArray(paymentsResult)
        ? paymentsResult
        : paymentsResult?.data || customerPayments;

      if (!currentBookings.length && customerBookings.length) {
        currentBookings = customerBookings;
      }

      if (!currentPayments.length && customerPayments.length) {
        currentPayments = customerPayments;
      }

      if (accountResult) {
        currentCustomer.account = accountResult;
      }

      if (!currentCustomer.account && customer.account) {
        currentCustomer.account = customer.account;
      }

      if (statementResult) {
        currentCustomer.statement = statementResult;
      }

      render();
    } catch (error) {
      renderFailure(
        'فشل تحميل بيانات العميل',
        error.message || 'تعذر الاتصال بالخادم'
      );

      toast(
        error.message || 'فشل تحميل بيانات العميل',
        'error'
      );
    }
  }

  function renderFailure(title, message) {
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-user-slash"></i>
        <h4>${esc(title)}</h4>
        <p>${esc(message)}</p>
        <button
          class="btn btn-primary"
          onclick="location.href='customers.html'"
        >
          العودة للعملاء
        </button>
      </div>
    `;
  }

  function render() {
    if (!container || !currentCustomer) return;

    const account = accountData();
    const balance = Math.max(0, account.balance);

    container.innerHTML = `
      <div class="customer-profile-header">
        <div class="avatar">
          ${esc(initials(currentCustomer.name))}
        </div>

        <div class="info">
          <div class="name">
            ${esc(currentCustomer.name || 'بدون اسم')}
          </div>

          <div class="phone">
            ${esc(currentCustomer.phone || '—')}
          </div>

          ${
            currentCustomer.notes
              ? `
                <div class="notes">
                  ${esc(currentCustomer.notes)}
                </div>
              `
              : ''
          }
        </div>

        <div class="status-badge">
          <span class="badge ${
            currentCustomer.is_active === false
              ? 'badge-danger'
              : balance > 0
                ? 'badge-danger'
                : 'badge-success'
          }">
            ${
              currentCustomer.is_active === false
                ? 'غير نشط'
                : balance > 0
                  ? `متبقي ${money(balance)}`
                  : 'مسدد'
            }
          </span>
        </div>
      </div>

      <div class="profile-summary">
        <div class="stat">
          <span class="label">إجمالي الفواتير</span>
          <span class="value">
            ${money(account.totalInvoices)}
          </span>
        </div>

        <div class="stat">
          <span class="label">إجمالي المدفوع</span>
          <span class="value success">
            ${money(account.totalPaid)}
          </span>
        </div>

        <div class="stat">
          <span class="label">الرصيد المستحق</span>
          <span class="value ${
            balance > 0 ? 'danger' : 'success'
          }">
            ${money(balance)}
          </span>
        </div>
      </div>

      <div class="tabs" id="profileTabs">
        <div class="tab active" data-tab="invoices">
          الفواتير
        </div>

        <div class="tab" data-tab="payments">
          المدفوعات
        </div>

        <div class="tab" data-tab="statement">
          كشف الحساب
        </div>
      </div>

      <div class="tab-content active" id="tab-invoices">
        ${renderInvoices()}
      </div>

      <div class="tab-content" id="tab-payments">
        ${renderPayments()}
      </div>

      <div class="tab-content" id="tab-statement">
        ${renderStatement()}
      </div>
    `;

    bindTabs();
  }

  function bindTabs() {
    document
      .querySelectorAll('#profileTabs .tab')
      .forEach(tab => {
        tab.addEventListener('click', () => {
          document
            .querySelectorAll('#profileTabs .tab')
            .forEach(item => item.classList.remove('active'));

          document
            .querySelectorAll('.tab-content')
            .forEach(item => item.classList.remove('active'));

          tab.classList.add('active');

          document
            .getElementById(`tab-${tab.dataset.tab}`)
            ?.classList.add('active');
        });
      });
  }

  function bookingPaid(booking) {
    return currentPayments
      .filter(
        payment =>
          Number(
            payment.booking_id ??
            payment.bookingId
          ) === Number(booking.id)
      )
      .reduce(
        (sum, payment) =>
          sum + Number(payment.amount || 0),
        0
      );
  }

  function bookingRemaining(booking) {
    return Math.max(
      0,
      Number(booking.total_amount || 0) -
      bookingPaid(booking)
    );
  }

  function renderInvoices() {
    if (!currentBookings.length) {
      return empty('لا توجد فواتير');
    }

    return [...currentBookings]
      .sort(
        (a, b) =>
          new Date(b.event_date || 0) -
          new Date(a.event_date || 0)
      )
      .map(booking => {
        const paid = bookingPaid(booking);
        const remaining = bookingRemaining(booking);
        const items = Array.isArray(booking.items)
          ? booking.items
          : [];

        const itemText = items
          .map(
            item =>
              `${esc(item.item_name || '')} × ${Number(
                item.quantity || 0
              )}`
          )
          .join(' · ');

        const deposit = Number(
          booking.plate_deposit || 0
        );

        const returned = Number(
          booking.plate_deposit_returned || 0
        );

        return `
          <div
            class="invoice-item"
            data-id="${booking.id}"
          >
            <div class="info">
              <div class="title">
                فاتورة #${booking.id}
                ${
                  booking.mark
                    ? ` · ${esc(booking.mark)}`
                    : ''
                }
              </div>

              <div class="sub invoice-meta">
                <span>
                  📅 ${esc(dateOnly(booking.event_date) || '—')}
                </span>

                <span>
                  ⏰ ${esc(
                    String(booking.delivery_time || '')
                      .slice(0, 5) || '—'
                  )}
                </span>

                <span>
                  🕐 ${esc(booking.delivery_period || '—')}
                </span>

                <span class="${statusClass(
                  booking.status
                )}">
                  ${esc(statusText(booking.status))}
                </span>
              </div>

              <div class="sub">
                ${esc(booking.delivery_address || '—')}
                ${
                  booking.notes
                    ? ` · ${esc(booking.notes)}`
                    : ''
                }
              </div>

              ${
                itemText
                  ? `<div class="sub">${itemText}</div>`
                  : ''
              }

              ${
                deposit > 0
                  ? `
                    <div class="sub">
                      تأمين الصحون: ${money(deposit)}
                      · المرتجع: ${money(returned)}
                    </div>
                  `
                  : ''
              }
            </div>

            <div class="amount-section">
              <span class="total">
                ${money(booking.total_amount)}
              </span>

              <span class="paid">
                مدفوع ${money(paid)}
              </span>

              ${
                remaining > 0
                  ? `
                    <span class="remaining">
                      متبقي ${money(remaining)}
                    </span>
                  `
                  : ''
              }
            </div>

            <div class="actions">
              <button
                type="button"
                class="btn-icon-sm btn-icon-primary"
                data-action="editBooking"
                title="تعديل"
              >
                <i class="fas fa-pen"></i>
              </button>

              <button
                type="button"
                class="btn-icon-sm btn-icon-danger"
                data-action="deleteBooking"
                title="حذف"
              >
                <i class="fas fa-trash"></i>
              </button>

              <button
                type="button"
                class="btn-icon-sm"
                data-action="exportBooking"
                title="طباعة"
              >
                <i class="fas fa-print"></i>
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function paymentMethodName(payment) {
    const method =
      payment.payment_method ??
      payment.paymentMethod;

    if (method?.name) {
      return method.name;
    }

    const methodId =
      payment.payment_method_id ??
      payment.paymentMethodId;

    const found = paymentMethods.find(
      item => Number(item.id) === Number(methodId)
    );

    return found?.name || 'غير محددة';
  }

  function renderPayments() {
    if (!currentPayments.length) {
      return empty('لا توجد مدفوعات');
    }

    return [...currentPayments]
      .sort(
        (a, b) =>
          new Date(
            b.payment_date ||
            b.paymentDate ||
            0
          ) -
          new Date(
            a.payment_date ||
            a.paymentDate ||
            0
          )
      )
      .map(payment => {
        const bookingId =
          payment.booking_id ??
          payment.bookingId;

        return `
          <div
            class="payment-item"
            data-id="${payment.id}"
          >
            <div class="info">
              <div class="title">
                دفعة
                ${
                  bookingId
                    ? `لفواتير #${bookingId}`
                    : 'عامة'
                }
                · ${esc(paymentMethodName(payment))}
              </div>

              <div class="sub">
                ${esc(
                  dateOnly(
                    payment.payment_date ||
                    payment.paymentDate
                  ) || '—'
                )}
                ${
                  payment.notes
                    ? ` · ${esc(payment.notes)}`
                    : ''
                }
              </div>
            </div>

            <div class="amount">
              +${money(payment.amount)}
            </div>

            <div class="actions">
              <button
                type="button"
                class="btn-icon-sm btn-icon-danger"
                data-action="deletePayment"
                title="حذف"
              >
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function statementRows() {
    const rows = [];

    currentBookings.forEach(booking => {
      rows.push({
        date:
          booking.invoice_date ||
          booking.event_date ||
          '',
        description:
          `فاتورة #${booking.id}` +
          (
            booking.mark
              ? ` - ${booking.mark}`
              : ''
          ),
        debit: Number(
          booking.total_amount || 0
        ),
        credit: 0,
        type: 'booking',
        id: booking.id
      });
    });

    currentPayments.forEach(payment => {
      rows.push({
        date: payment.payment_date || '',
        description:
          `دفعة ${
            payment.booking_id
              ? `لفواتير #${payment.booking_id}`
              : 'عامة'
          }` +
          (
            payment.notes
              ? ` - ${payment.notes}`
              : ''
          ),
        debit: 0,
        credit: Number(payment.amount || 0),
        type: 'payment',
        id: payment.id
      });
    });

    return rows.sort(
      (a, b) =>
        new Date(a.date) -
        new Date(b.date)
    );
  }

  function renderStatement() {
    const rows = statementRows();

    if (!rows.length) {
      return empty('لا توجد حركات');
    }

    let balance = 0;

    const content = rows
      .map(row => {
        balance +=
          row.debit -
          row.credit;

        return `
          <div class="statement-item">
            <div class="desc">
              <span style="font-weight:600;">
                ${esc(row.description)}
              </span>

              <span class="date">
                ${esc(dateOnly(row.date))}
              </span>
            </div>

            <span class="${
              row.debit
                ? 'debit'
                : 'credit'
            }">
              ${money(
                row.debit ||
                row.credit
              )}
            </span>

            <span class="balance">
              ${money(balance)}
            </span>
          </div>
        `;
      })
      .join('');

    return `
      <div
        style="
          display:flex;
          justify-content:flex-end;
          margin-bottom:var(--space-3);
        "
      >
        <button
          type="button"
          class="btn btn-sm btn-secondary"
          data-action="exportStatement"
        >
          <i class="fas fa-print"></i>
          طباعة كشف الحساب
        </button>
      </div>

      ${content}
    `;
  }

  function fillPaymentMethods(selectedId = null) {
    const bookingSelect =
      document.getElementById(
        'bookingPaymentMethod'
      );

    const paymentBox =
      document.getElementById(
        'paymentMethodsContainer'
      );

    const activeMethods =
      paymentMethods.filter(
        method => method.is_active !== false
      );

    if (bookingSelect) {
      bookingSelect.innerHTML =
        activeMethods
          .map(
            method =>
              `<option value="${method.id}">
                ${esc(method.name)}
              </option>`
          )
          .join('');

      if (selectedId !== null) {
        bookingSelect.value =
          String(selectedId);
      }
    }

    if (paymentBox) {
      paymentBox.innerHTML =
        activeMethods
          .map(
            (method, index) =>
              `
                <label class="payment-method-option">
                  <input
                    type="radio"
                    name="customerPaymentMethod"
                    value="${method.id}"
                    ${
                      selectedId !== null
                        ? Number(selectedId) ===
                          Number(method.id)
                          ? 'checked'
                          : ''
                        : index === 0
                          ? 'checked'
                          : ''
                    }
                  >
                  ${esc(method.name)}
                </label>
              `
          )
          .join('');
    }
  }

  function fillPaymentBookings(selectedId = '') {
    const select =
      document.getElementById(
        'paymentBooking'
      );

    if (!select) return;

    select.innerHTML =
      '<option value="">دفعة عامة في حساب العميل</option>' +
      currentBookings
        .map(
          booking =>
            `
              <option value="${booking.id}">
                فاتورة #${booking.id}
                · ${esc(
                  booking.mark ||
                  dateOnly(
                    booking.event_date
                  ) ||
                  'فاتورة'
                )}
              </option>
            `
        )
        .join('');

    select.value =
      selectedId
        ? String(selectedId)
        : '';
  }

  function resetBookingForm(booking = null) {
    const editing = !!booking;

    editingBookingId = editing
      ? Number(booking.id)
      : null;

    document.getElementById(
      'bookingEventDate'
    ).value =
      booking?.event_date ||
      nowDate();

    document.getElementById(
      'bookingDeliveryTime'
    ).value =
      String(
        booking?.delivery_time ||
        '14:00'
      ).slice(0, 5);

    document.getElementById(
      'bookingDeliveryPeriod'
    ).value =
      booking?.delivery_period ||
      'ظهراً';

    document.getElementById(
      'bookingAddress'
    ).value =
      booking?.delivery_address ||
      '';

    document.getElementById(
      'bookingMark'
    ).value =
      booking?.mark ||
      '';

    document.getElementById(
      'bookingPlateDeposit'
    ).value =
      booking?.plate_deposit ??
      '';

    document.getElementById(
      'bookingPlateReturned'
    ).value =
      booking?.plate_deposit_returned ??
      '';

    document.getElementById(
      'bookingStatus'
    ).value =
      booking?.status ||
      'new';

    document.getElementById(
      'bookingNotes'
    ).value =
      booking?.notes ||
      '';

    document.getElementById(
      'bookingInitialPayment'
    ).value = '';

    document.getElementById(
      'bookingCustomerName'
    ).textContent =
      currentCustomer?.name ||
      '—';

    document.getElementById(
      'bookingCustomerPhone'
    ).textContent =
      currentCustomer?.phone ||
      '—';

    document.getElementById(
      'initialPaymentGroup'
    ).style.display =
      editing
        ? 'none'
        : 'block';

    document.getElementById(
      'initialPaymentMethodGroup'
    ).style.display =
      editing
        ? 'none'
        : 'block';

    fillPaymentMethods();

    renderBookingItems(
      booking?.items || []
    );

    updateBookingPreview();
  }

  function renderBookingItems(items) {
    const box =
      document.getElementById(
        'bookingItemsContainer'
      );

    if (!box) return;

    const source =
      items.length
        ? items
        : [{}];

    box.innerHTML =
      source
        .map(
          (item, index) => {
            const selectedName =
              item.item_name || '';

            const catalog =
              allItems.find(
                item =>
                  String(item.name) ===
                  String(selectedName)
              );

            const selectedId =
              catalog?.id || '';

            const price =
              Number(
                item.unit_price ??
                catalog?.default_price ??
                0
              );

            const quantity =
              Number(
                item.quantity ??
                1
              );

            return `
              <div
                class="item-row"
                data-index="${index}"
              >
                <select
                  class="form-input item-select"
                >
                  <option value="">
                    اختر صنف
                  </option>

                  ${allItems
                    .map(
                      item =>
                        `
                          <option
                            value="${item.id}"
                            data-price="${item.default_price}"
                            data-name="${esc(item.name)}"
                            ${
                              Number(item.id) ===
                              Number(selectedId)
                                ? 'selected'
                                : ''
                            }
                          >
                            ${esc(item.name)}
                            · ${money(
                              item.default_price
                            )}
                          </option>
                        `
                    )
                    .join('')}
                </select>

                <input
                  type="number"
                  class="form-input item-qty"
                  min="0.01"
                  step="0.01"
                  value="${quantity}"
                >

                <input
                  type="number"
                  class="form-input item-price"
                  min="0"
                  step="0.01"
                  value="${price}"
                >

                <span class="item-total">
                  ${money(
                    quantity * price
                  )}
                </span>

                <button
                  type="button"
                  class="btn-icon-sm btn-icon-danger remove-item-btn"
                  title="حذف"
                >
                  <i class="fas fa-times"></i>
                </button>
              </div>
            `;
          }
        )
        .join('');

    updateBookingPreview();
  }

  function renderNewItemRow() {
    const index =
      document.querySelectorAll(
        '#bookingItemsContainer .item-row'
      ).length;

    return `
      <div
        class="item-row"
        data-index="${index}"
      >
        <select class="form-input item-select">
          <option value="">
            اختر صنف
          </option>

          ${allItems
            .map(
              item =>
                `
                  <option
                    value="${item.id}"
                    data-price="${item.default_price}"
                    data-name="${esc(item.name)}"
                  >
                    ${esc(item.name)}
                    · ${money(
                      item.default_price
                    )}
                  </option>
                `
            )
            .join('')}
        </select>

        <input
          type="number"
          class="form-input item-qty"
          min="0.01"
          step="0.01"
          value="1"
        >

        <input
          type="number"
          class="form-input item-price"
          min="0"
          step="0.01"
          value="0"
        >

        <span class="item-total">
          ${money(0)}
        </span>

        <button
          type="button"
          class="btn-icon-sm btn-icon-danger remove-item-btn"
          title="حذف"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  }

  function updateItemRow(row) {
    if (!row) return;

    const select =
      row.querySelector('.item-select');

    const price =
      row.querySelector('.item-price');

    const quantity =
      row.querySelector('.item-qty');

    const option =
      select?.options[
        select.selectedIndex
      ];

    if (
      option?.value &&
      (!price.value ||
        Number(price.value) === 0)
    ) {
      price.value =
        option.dataset.price ||
        0;
    }

    const qty =
      Number(quantity?.value) ||
      0;

    const unitPrice =
      Number(price?.value) ||
      0;

    const total =
      qty *
      unitPrice;

    const totalElement =
      row.querySelector(
        '.item-total'
      );

    if (totalElement) {
      totalElement.textContent =
        money(total);
    }

    updateBookingPreview();
  }

  function collectItems() {
    return [
      ...document.querySelectorAll(
        '#bookingItemsContainer .item-row'
      )
    ]
      .map(row => {
        const select =
          row.querySelector(
            '.item-select'
          );

        const option =
          select?.options[
            select.selectedIndex
          ];

        const quantity =
          Number(
            row.querySelector(
              '.item-qty'
            )?.value
          ) || 0;

        const unitPrice =
          Number(
            row.querySelector(
              '.item-price'
            )?.value
          ) || 0;

        return {
          item_name:
            option?.dataset.name ||
            '',
          quantity,
          unit_price:
            unitPrice,
          total_price:
            Number(
              (
                quantity *
                unitPrice
              ).toFixed(2)
            )
        };
      })
      .filter(
        item =>
          item.item_name &&
          item.quantity > 0 &&
          item.unit_price >= 0
      );
  }

  function itemsTotal() {
    return collectItems()
      .reduce(
        (sum, item) =>
          sum +
          item.total_price,
        0
      );
  }

  function updateBookingPreview() {
    const total =
      itemsTotal();

    const deposit =
      Number(
        document.getElementById(
          'bookingPlateDeposit'
        )?.value
      ) || 0;

    const paid =
      Number(
        document.getElementById(
          'bookingInitialPayment'
        )?.value
      ) || 0;

    const itemsTotalElement =
      document.getElementById(
        'bookingItemsTotal'
      );

    const plateElement =
      document.getElementById(
        'bookingPlateDisplay'
      );

    const grandTotalElement =
      document.getElementById(
        'bookingGrandTotal'
      );

    const remainingElement =
      document.getElementById(
        'bookingRemainingPreview'
      );

    if (itemsTotalElement) {
      itemsTotalElement.textContent =
        money(total);
    }

    if (plateElement) {
      plateElement.textContent =
        money(deposit);
    }

    if (grandTotalElement) {
      grandTotalElement.textContent =
        money(total);
    }

    if (remainingElement) {
      remainingElement.textContent =
        `المتبقي بعد الدفعة: ${money(
          Math.max(
            0,
            total - paid
          )
        )}`;
    }
  }

  function openBookingModal(booking = null) {
    if (
      typeof window.setTransactionMode ===
      'function'
    ) {
      window.setTransactionMode(
        'booking'
      );
    }

    resetBookingForm(
      booking
    );

    const title =
      document.getElementById(
        'transactionModalTitle'
      );

    const save =
      document.getElementById(
        'transactionSaveBtn'
      );

    if (title) {
      title.textContent =
        booking
          ? 'تعديل الفاتورة'
          : 'حجز جديد';
    }

    if (save) {
      save.textContent =
        booking
          ? 'تحديث الفاتورة'
          : 'حفظ الحجز';
    }

    openModal();
  }

  function openPaymentModal() {
    if (
      typeof window.setTransactionMode ===
      'function'
    ) {
      window.setTransactionMode(
        'payment'
      );
    }

    document.getElementById(
      'paymentCustomerName'
    ).textContent =
      currentCustomer?.name ||
      '—';

    document.getElementById(
      'paymentCustomerPhone'
    ).textContent =
      currentCustomer?.phone ||
      '—';

    document.getElementById(
      'paymentAmount'
    ).value = '';

    document.getElementById(
      'paymentDate'
    ).value =
      nowDateTime();

    document.getElementById(
      'paymentNotes'
    ).value = '';

    fillPaymentBookings();

    fillPaymentMethods();

    updatePaymentPreview();

    const title =
      document.getElementById(
        'transactionModalTitle'
      );

    const save =
      document.getElementById(
        'transactionSaveBtn'
      );

    if (title) {
      title.textContent =
        'تسجيل دفعة';
    }

    if (save) {
      save.textContent =
        'تسجيل الدفعة';
    }

    openModal();
  }

  function updatePaymentPreview() {
    const balance =
      Math.max(
        0,
        accountData().balance
      );

    const amount =
      Number(
        document.getElementById(
          'paymentAmount'
        )?.value
      ) || 0;

    const after =
      Math.max(
        0,
        balance - amount
      );

    const current =
      document.getElementById(
        'paymentCurrentBalance'
      );

    const afterElement =
      document.getElementById(
        'paymentAfterBalance'
      );

    if (current) {
      current.textContent =
        money(balance);
    }

    if (afterElement) {
      afterElement.textContent =
        money(after);
    }
  }

  async function saveBooking() {
    if (saving) return;

    const eventDate =
      document.getElementById(
        'bookingEventDate'
      ).value;

    const deliveryTime =
      document.getElementById(
        'bookingDeliveryTime'
      ).value;

    const deliveryPeriod =
      document.getElementById(
        'bookingDeliveryPeriod'
      ).value;

    const address =
      document.getElementById(
        'bookingAddress'
      ).value.trim();

    const mark =
      document.getElementById(
        'bookingMark'
      ).value.trim();

    const deposit =
      Number(
        document.getElementById(
          'bookingPlateDeposit'
        ).value
      ) || 0;

    const returned =
      Number(
        document.getElementById(
          'bookingPlateReturned'
        ).value
      ) || 0;

    const status =
      document.getElementById(
        'bookingStatus'
      ).value;

    const notes =
      document.getElementById(
        'bookingNotes'
      ).value.trim();

    const initialPayment =
      Number(
        document.getElementById(
          'bookingInitialPayment'
        ).value
      ) || 0;

    const paymentMethodId =
      Number(
        document.getElementById(
          'bookingPaymentMethod'
        ).value
      ) || 0;

    const items =
      collectItems();

    const total =
      Number(
        items
          .reduce(
            (sum, item) =>
              sum +
              item.total_price,
            0
          )
          .toFixed(2)
      );

    if (
      !eventDate ||
      !deliveryTime ||
      !deliveryPeriod ||
      !address
    ) {
      toast(
        'أكمل بيانات الفاتورة المطلوبة',
        'warning'
      );
      return;
    }

    if (!items.length) {
      toast(
        'يجب إضافة صنف واحد على الأقل',
        'warning'
      );
      return;
    }

    if (
      deposit <= 0 &&
      returned > 0
    ) {
      toast(
        'لا يمكن تسجيل مبلغ مرتجع بدون تأمين',
        'warning'
      );
      return;
    }

    if (returned > deposit) {
      toast(
        'مبلغ التأمين المرتجع لا يمكن أن يتجاوز التأمين',
        'warning'
      );
      return;
    }

    if (
      initialPayment >
      total
    ) {
      toast(
        'الدفعة الأولى لا يمكن أن تتجاوز إجمالي الفاتورة',
        'warning'
      );
      return;
    }

    if (
      initialPayment > 0 &&
      !paymentMethodId
    ) {
      toast(
        'اختر طريقة الدفع',
        'warning'
      );
      return;
    }

    const payload = {
      customer_id:
        customerId,
      event_date:
        eventDate,
      delivery_time:
        deliveryTime,
      delivery_period:
        deliveryPeriod,
      delivery_address:
        address,
      mark:
        mark || null,
      total_amount:
        total,
      plate_deposit:
        deposit || null,
      plate_deposit_returned:
        returned || null,
      status,
      notes:
        notes || null,
      items
    };

    if (!editingBookingId) {
      payload.invoice_date =
        new Date()
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ');

      if (initialPayment > 0) {
        payload.initial_payment =
          initialPayment;

        payload.payment_method_id =
          paymentMethodId;

        payload.payment_notes =
          notes || null;
      }
    }

    setSaving(
      true,
      'جاري الحفظ...'
    );

    try {
      if (editingBookingId) {
        await apiCall(
          ['updateBooking'],
          editingBookingId,
          payload
        );

        toast(
          'تم تحديث الفاتورة بنجاح',
          'success'
        );
      } else {
        await apiCall(
          [
            'addBooking',
            'createBooking'
          ],
          payload
        );

        toast(
          'تم إضافة الفاتورة بنجاح',
          'success'
        );
      }

      closeModal();

      editingBookingId =
        null;

      await loadData();
    } catch (error) {
      toast(
        error.message ||
        'فشل حفظ الفاتورة',
        'error'
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePayment() {
    if (saving) return;

    const amount =
      Number(
        document.getElementById(
          'paymentAmount'
        ).value
      ) || 0;

    const bookingId =
      Number(
        document.getElementById(
          'paymentBooking'
        ).value
      ) || null;

    const paymentMethodId =
      Number(
        document.querySelector(
          'input[name="customerPaymentMethod"]:checked'
        )?.value
      ) || 0;

    const paymentDate =
      document.getElementById(
        'paymentDate'
      ).value;

    const notes =
      document.getElementById(
        'paymentNotes'
      ).value.trim();

    const balance =
      Math.max(
        0,
        accountData().balance
      );

    if (amount <= 0) {
      toast(
        'أدخل مبلغاً صحيحاً',
        'warning'
      );
      return;
    }

    if (amount > balance) {
      toast(
        `المبلغ يتجاوز الرصيد الحالي ${money(balance)}`,
        'error'
      );
      return;
    }

    if (!paymentMethodId) {
      toast(
        'اختر طريقة الدفع',
        'warning'
      );
      return;
    }

    if (!paymentDate) {
      toast(
        'حدد تاريخ الدفع',
        'warning'
      );
      return;
    }

    setSaving(
      true,
      'جاري التسجيل...'
    );

    try {
      await apiCall(
        [
          'addCustomerPayment',
          'createCustomerPayment'
        ],
        {
          customer_id:
            customerId,
          booking_id:
            bookingId,
          amount,
          payment_method_id:
            paymentMethodId,
          payment_date:
            paymentDate.replace(
              'T',
              ' '
            ),
          notes:
            notes || null
        }
      );

      toast(
        'تم تسجيل الدفعة بنجاح',
        'success'
      );

      closeModal();

      await loadData();
    } catch (error) {
      toast(
        error.message ||
        'فشل تسجيل الدفعة',
        'error'
      );
    } finally {
      setSaving(false);
    }
  }

  function setSaving(value, text) {
    saving = value;

    const button =
      document.getElementById(
        'transactionSaveBtn'
      );

    if (!button) return;

    if (value) {
      button.disabled = true;
      button.innerHTML =
        `<i class="fas fa-spinner fa-spin"></i> ${text}`;
      return;
    }

    button.disabled = false;

    const mode =
      document.querySelector(
        '.switch-btn.active'
      )?.dataset.mode;

    button.textContent =
      mode === 'payment'
        ? 'تسجيل الدفعة'
        : editingBookingId
          ? 'تحديث الفاتورة'
          : 'حفظ الحجز';
  }

  async function deleteBooking(id) {
    const booking =
      currentBookings.find(
        item =>
          Number(item.id) ===
          Number(id)
      );

    if (!booking) return;

    confirmAction({
      title: 'حذف الفاتورة',
      message:
        `هل أنت متأكد من حذف الفاتورة #${id}؟`,
      confirmText: 'حذف',
      danger: true,
      onConfirm: async () => {
        try {
          await apiCall(
            ['deleteBooking'],
            id
          );

          toast(
            'تم حذف الفاتورة بنجاح',
            'success'
          );

          await loadData();
        } catch (error) {
          toast(
            error.message ||
            'تعذر حذف الفاتورة',
            'error'
          );
        }
      }
    });
  }

  async function deletePayment(id) {
    const payment =
      currentPayments.find(
        item =>
          Number(item.id) ===
          Number(id)
      );

    if (!payment) return;

    confirmAction({
      title: 'حذف الدفعة',
      message:
        `هل أنت متأكد من حذف الدفعة بقيمة ${money(payment.amount)}؟`,
      confirmText: 'حذف',
      danger: true,
      onConfirm: async () => {
        try {
          await apiCall(
            ['deleteCustomerPayment'],
            id
          );

          toast(
            'تم حذف الدفعة بنجاح',
            'success'
          );

          await loadData();
        } catch (error) {
          toast(
            error.message ||
            'تعذر حذف الدفعة',
            'error'
          );
        }
      }
    });
  }

  function printBooking(id) {
    const booking =
      currentBookings.find(
        item =>
          Number(item.id) ===
          Number(id)
      );

    if (!booking) return;

    const paid =
      bookingPaid(booking);

    const remaining =
      bookingRemaining(
        booking
      );

    const items =
      Array.isArray(
        booking.items
      )
        ? booking.items
        : [];

    const itemsHtml =
      items
        .map(
          item =>
            `
              <tr>
                <td>${esc(item.item_name)}</td>
                <td>${Number(item.quantity || 0)}</td>
                <td>${money(item.unit_price)}</td>
                <td>${money(item.total_price)}</td>
              </tr>
            `
        )
        .join('');

    const html = `
      <!doctype html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>فاتورة #${booking.id}</title>
        <style>
          body{
            font-family:Arial,sans-serif;
            padding:30px;
            color:#222
          }
          h1,h2{
            margin:0 0 12px
          }
          table{
            width:100%;
            border-collapse:collapse;
            margin-top:20px
          }
          th,td{
            border:1px solid #ddd;
            padding:9px;
            text-align:right
          }
          th{
            background:#f5f5f5
          }
          .totals{
            margin-top:20px;
            line-height:2
          }
        </style>
      </head>
      <body>
        <h1>شواطئ عدن</h1>
        <h2>فاتورة #${booking.id}</h2>

        <p>
          العميل:
          ${esc(currentCustomer.name)}
        </p>

        <p>
          تاريخ المناسبة:
          ${esc(dateOnly(booking.event_date))}
        </p>

        <p>
          وقت التسليم:
          ${esc(
            String(
              booking.delivery_time || ''
            ).slice(0, 5)
          )}
          ${esc(
            booking.delivery_period || ''
          )}
        </p>

        <p>
          العنوان:
          ${esc(
            booking.delivery_address || ''
          )}
        </p>

        <p>
          العلامة:
          ${esc(
            booking.mark || ''
          )}
        </p>

        <table>
          <thead>
            <tr>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>سعر الوحدة</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div>
            إجمالي الفاتورة:
            ${money(booking.total_amount)}
          </div>

          <div>
            المدفوع:
            ${money(paid)}
          </div>

          <div>
            المتبقي:
            ${money(remaining)}
          </div>

          <div>
            تأمين الصحون:
            ${money(booking.plate_deposit || 0)}
          </div>

          <div>
            المرتجع:
            ${money(
              booking.plate_deposit_returned || 0
            )}
          </div>

          <div>
            الحالة:
            ${esc(
              statusText(
                booking.status
              )
            )}
          </div>

          <div>
            ملاحظات:
            ${esc(
              booking.notes || ''
            )}
          </div>
        </div>
      </body>
      </html>
    `;

    const win =
      window.open(
        '',
        '_blank'
      );

    if (!win) {
      toast(
        'تعذر فتح نافذة الطباعة',
        'error'
      );
      return;
    }

    win.document.write(
      html
    );

    win.document.close();
    win.focus();

    setTimeout(
      () => win.print(),
      150
    );
  }

  function printStatement() {
    const rows =
      statementRows();

    if (!rows.length) {
      toast(
        'لا توجد حركات للطباعة',
        'warning'
      );
      return;
    }

    let balance = 0;

    const body =
      rows
        .map(row => {
          balance +=
            row.debit -
            row.credit;

          return `
            <tr>
              <td>${esc(dateOnly(row.date))}</td>
              <td>${esc(row.description)}</td>
              <td>
                ${
                  row.debit
                    ? money(row.debit)
                    : '-'
                }
              </td>
              <td>
                ${
                  row.credit
                    ? money(row.credit)
                    : '-'
                }
              </td>
              <td>${money(balance)}</td>
            </tr>
          `;
        })
        .join('');

    const html = `
      <!doctype html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>
          كشف حساب ${esc(currentCustomer.name)}
        </title>
        <style>
          body{
            font-family:Arial,sans-serif;
            padding:30px;
            color:#222
          }
          table{
            width:100%;
            border-collapse:collapse;
            margin-top:20px
          }
          th,td{
            border:1px solid #ddd;
            padding:9px;
            text-align:right
          }
          th{
            background:#f5f5f5
          }
          h1{
            margin-bottom:4px
          }
        </style>
      </head>
      <body>
        <h1>شواطئ عدن</h1>

        <h2>
          كشف حساب العميل:
          ${esc(currentCustomer.name)}
        </h2>

        <p>
          الجوال:
          ${esc(
            currentCustomer.phone ||
            '—'
          )}
        </p>

        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>البيان</th>
              <th>مدين</th>
              <th>دائن</th>
              <th>الرصيد</th>
            </tr>
          </thead>

          <tbody>
            ${body}
          </tbody>
        </table>

        <h3>
          الرصيد الحالي:
          ${money(balance)}
        </h3>
      </body>
      </html>
    `;

    const win =
      window.open(
        '',
        '_blank'
      );

    if (!win) {
      toast(
        'تعذر فتح نافذة الطباعة',
        'error'
      );
      return;
    }

    win.document.write(
      html
    );

    win.document.close();
    win.focus();

    setTimeout(
      () => win.print(),
      150
    );
  }

  function bindContainer() {
    if (!container) return;

    container.addEventListener(
      'click',
      event => {
        const button =
          event.target.closest(
            '[data-action]'
          );

        if (!button) return;

        const action =
          button.dataset.action;

        const card =
          button.closest(
            '[data-id]'
          );

        const id =
          Number(
            card?.dataset.id
          );

        if (
          action ===
          'editBooking'
        ) {
          const booking =
            currentBookings.find(
              item =>
                Number(item.id) ===
                id
            );

          openBookingModal(
            booking || null
          );
        }

        if (
          action ===
          'deleteBooking'
        ) {
          deleteBooking(id);
        }

        if (
          action ===
          'exportBooking'
        ) {
          printBooking(id);
        }

        if (
          action ===
          'deletePayment'
        ) {
          deletePayment(id);
        }

        if (
          action ===
          'exportStatement'
        ) {
          printStatement();
        }
      }
    );
  }

  function bindModal() {
    document
      .querySelectorAll(
        '.switch-btn'
      )
      .forEach(button => {
        button.addEventListener(
          'click',
          () => {
            const mode =
              button.dataset.mode;

            if (
              mode ===
              'booking'
            ) {
              openBookingModal();
            } else {
              openPaymentModal();
            }
          }
        );
      });

    document
      .getElementById(
        'transactionSaveBtn'
      )
      ?.addEventListener(
        'click',
        () => {
          const mode =
            document.querySelector(
              '.switch-btn.active'
            )?.dataset.mode ||
            'booking';

          if (
            mode ===
            'booking'
          ) {
            saveBooking();
          } else {
            savePayment();
          }
        }
      );

    document
      .getElementById(
        'addBookingItemBtn'
      )
      ?.addEventListener(
        'click',
        () => {
          const box =
            document.getElementById(
              'bookingItemsContainer'
            );

          if (!box) return;

          box.insertAdjacentHTML(
            'beforeend',
            renderNewItemRow()
          );
        }
      );

    document
      .getElementById(
        'bookingItemsContainer'
      )
      ?.addEventListener(
        'change',
        event => {
          if (
            event.target.matches(
              '.item-select'
            )
          ) {
            updateItemRow(
              event.target.closest(
                '.item-row'
              )
            );
          }
        }
      );

    document
      .getElementById(
        'bookingItemsContainer'
      )
      ?.addEventListener(
        'input',
        event => {
          if (
            event.target.matches(
              '.item-qty,.item-price'
            )
          ) {
            updateItemRow(
              event.target.closest(
                '.item-row'
              )
            );
          }
        }
      );

    document
      .getElementById(
        'bookingItemsContainer'
      )
      ?.addEventListener(
        'click',
        event => {
          const button =
            event.target.closest(
              '.remove-item-btn'
            );

          if (!button) return;

          const row =
            button.closest(
              '.item-row'
            );

          const box =
            document.getElementById(
              'bookingItemsContainer'
            );

          if (
            box.querySelectorAll(
              '.item-row'
            ).length > 1
          ) {
            row.remove();
          } else {
            row
              .querySelectorAll(
                'input,select'
              )
              .forEach(
                field =>
                  field.value = ''
              );
          }

          updateBookingPreview();
        }
      );

    [
      'bookingPlateDeposit',
      'bookingPlateReturned',
      'bookingInitialPayment'
    ].forEach(id => {
      document
        .getElementById(id)
        ?.addEventListener(
          'input',
          updateBookingPreview
        );
    });

    document
      .getElementById(
        'paymentAmount'
      )
      ?.addEventListener(
        'input',
        updatePaymentPreview
      );

    document
      .querySelectorAll(
        '[data-close="transactionModal"]'
      )
      .forEach(button => {
        button.addEventListener(
          'click',
          closeModal
        );
      });
  }

  if (fab) {
    fab.addEventListener(
      'click',
      () => {
        if (!currentCustomer) return;
        openBookingModal();
      }
    );
  }

  bindContainer();
  bindModal();

  const params =
    new URLSearchParams(
      window.location.search
    );

  customerId =
    Number(
      params.get('id')
    ) || 0;

  if (!customerId) {
    renderFailure(
      'معرف العميل غير صحيح',
      'اختر عميلاً من صفحة العملاء.'
    );
  } else if (
    window.layoutReady
  ) {
    loadData();
  } else {
    document.addEventListener(
      'layout:ready',
      loadData,
      { once: true }
    );

    setTimeout(() => {
      if (
        window.API &&
        currentCustomer === null
      ) {
        loadData();
      }
    }, 500);
  }
})();