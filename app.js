// ============================================
// SHOP INVENTORY - app.js v3.0
// New: Multi-profile, Colours, Send feedback,
//      WhatsApp return, Colour book
// ============================================

// ---- PROFILE MANAGER ----
function initProfileSystem() {
    // Migrate old single-email user to profile system
    const oldEmail = localStorage.getItem('userEmail');
    const profiles = JSON.parse(localStorage.getItem('allProfiles') || '[]');

    if (oldEmail && profiles.length === 0) {
        const defaultProfile = {
            id: 'profile_' + Date.now(),
            name: oldEmail.split('@')[0],
            email: oldEmail,
            avatar: '👤',
            createdAt: new Date().toISOString()
        };
        localStorage.setItem('allProfiles', JSON.stringify([defaultProfile]));
        localStorage.setItem('activeProfile', defaultProfile.id);
        localStorage.removeItem('userEmail');
        storage.switchUser(defaultProfile.id);
    }
}

function showProfileScreen() {
    const profiles = storage.getAllProfiles();
    const screen = document.getElementById('profileScreen');
    const list = document.getElementById('profileList');

    // Clear active so next selection sets it fresh
    localStorage.removeItem('activeProfile');

    list.innerHTML = profiles.map(p => `
        <div class="profile-card" onclick="selectProfile('${p.id}')">
            <div class="profile-avatar">${p.avatar || '👤'}</div>
            <div class="profile-name">${p.name}</div>
            <div class="profile-email">${p.email}</div>
        </div>
    `).join('');

    screen.style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('emailGate').style.display = 'none';
}

function selectProfile(profileId) {
    localStorage.setItem('activeProfile', profileId);
    storage.switchUser(profileId);
    const profiles = storage.getAllProfiles();
    const p = profiles.find(pr => pr.id === profileId);
    if (p) {
        showMainApp(p.email, p);
        if (window.app) {
            window.app.cartItems = [];
            window.app.updateDashboard();
            window.app.changePage('dashboard');
        }
    }
}

function showAddProfileForm() {
    document.getElementById('addProfileForm').style.display = 'block';
    document.getElementById('newProfileEmail').focus();
}

function submitNewProfile() {
    const email = document.getElementById('newProfileEmail').value.trim();
    const name = document.getElementById('newProfileName').value.trim() || email.split('@')[0];
    const avatar = document.getElementById('newProfileAvatar').value || '👤';

    if (!email || !email.includes('@')) {
        alert('Please enter a valid email address.');
        return;
    }

    const profileId = 'profile_' + Date.now();
    const profile = { id: profileId, name, email, avatar, createdAt: new Date().toISOString() };
    storage.addProfile(profile);
    storage.switchUser(profileId);
    localStorage.setItem('activeProfile', profileId);
    showMainApp(email, profile);
    if (window.app) {
        window.app.cartItems = [];
        window.app.updateDashboard();
        window.app.changePage('dashboard');
    }
}

function checkProfileGate() {
    initProfileSystem();
    const profiles = storage.getAllProfiles();
    const active = localStorage.getItem('activeProfile');

    if (profiles.length === 0) {
        // First time — show email gate
        document.getElementById('emailGate').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('profileScreen').style.display = 'none';
    } else {
        // Always show profile picker — user must select every time
        showProfileScreen();
    }
}

function submitEmailGate() {
    const email = document.getElementById('gateEmail').value.trim();
    if (!email || !email.includes('@')) {
        alert('Please enter a valid email address.');
        return;
    }
    const profileId = 'profile_' + Date.now();
    const profile = {
        id: profileId,
        name: email.split('@')[0],
        email,
        avatar: '👤',
        createdAt: new Date().toISOString()
    };
    storage.addProfile(profile);
    storage.switchUser(profileId);
    localStorage.setItem('activeProfile', profileId);
    showMainApp(email, profile);
    if (window.app) {
        window.app.cartItems = [];
        window.app.updateDashboard();
        window.app.changePage('dashboard');
    }
}

function showMainApp(email, profile) {
    document.getElementById('emailGate').style.display = 'none';
    document.getElementById('profileScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    const chip = document.getElementById('userEmailChip');
    if (chip) {
        const p = profile || { avatar: '👤', name: email };
        chip.textContent = (p.avatar || '👤') + ' ' + (p.name || email);
        chip.onclick = () => { if (storage.getAllProfiles().length > 1) showProfileScreen(); };
        chip.style.cursor = storage.getAllProfiles().length > 1 ? 'pointer' : 'default';
        chip.title = storage.getAllProfiles().length > 1 ? 'Switch profile' : email;
    }
}

function logoutProfile() {
    const profiles = storage.getAllProfiles();
    if (profiles.length > 1) {
        showProfileScreen();
    } else {
        // Only one profile; just stay
    }
}

// ---- MOBILE SIDEBAR ----
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
}

function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
}

// ============================================
// MAIN APP CLASS
// ============================================
class ShopApp {
    constructor() {
        this.currentEditingProductId = null;
        this.cartItems = [];
        this.currentInvoice = null;
        this.cameraStream = null;
        this.photoBase64 = null;
        this.lowStockThreshold = parseInt(localStorage.getItem('lowStockThreshold')) || 10;
        this.pendingBillingProductId = null;
        this.productColors = []; // colors being added in product modal
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTheme();
        this.updateDashboard();
        this.loadProducts();
        this.setDateToToday();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageName = e.currentTarget.dataset.page;
                if (pageName) {
                    this.changePage(pageName);
                    closeMobileSidebar();
                }
            });
        });

        document.querySelectorAll('.view-all').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageName = e.currentTarget.dataset.page;
                if (pageName) this.changePage(pageName);
            });
        });

        // Products
        document.getElementById('addProductBtnMain').addEventListener('click', () => this.openProductModal());
        document.getElementById('productSearch').addEventListener('input', (e) => this.searchProducts(e.target.value));
        document.getElementById('productForm').addEventListener('submit', (e) => this.handleProductSubmit(e));

        // Camera / upload
        document.getElementById('cameraBtn').addEventListener('click', (e) => { e.preventDefault(); this.openCamera(); });
        document.getElementById('uploadBtn').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('productPhoto').click(); });
        document.getElementById('productPhoto').addEventListener('change', (e) => this.previewPhoto(e));
        document.getElementById('captureBtn').addEventListener('click', () => this.capturePhoto());
        document.getElementById('retakeBtn').addEventListener('click', () => this.retakePhoto());
        document.getElementById('closeCamera').addEventListener('click', () => this.closeCamera());

        // Color add in product modal
        const addColorBtn = document.getElementById('addColorBtn');
        if (addColorBtn) addColorBtn.addEventListener('click', () => this.addColorToProduct());
        const colorInput = document.getElementById('colorInput');
        if (colorInput) colorInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.addColorToProduct(); } });

        // Billing
        document.getElementById('addItemBtn').addEventListener('click', () => this.addToCart());
        document.getElementById('generateInvoiceBtn').addEventListener('click', () => this.generateInvoice());
        document.getElementById('clearCartBtn').addEventListener('click', () => this.clearCart());
        document.getElementById('newInvoiceBtn').addEventListener('click', () => this.newInvoice());

        // Invoices
        document.getElementById('invoiceSearch').addEventListener('input', (e) => this.searchInvoices(e.target.value));

        // Low Stock
        const saveThresholdBtn = document.getElementById('saveThresholdBtn');
        if (saveThresholdBtn) {
            saveThresholdBtn.addEventListener('click', () => this.saveThreshold());
            document.getElementById('lowStockThreshold').value = this.lowStockThreshold;
        }

        // Reorder
        const saveReorderSettingsBtn = document.getElementById('saveReorderSettingsBtn');
        if (saveReorderSettingsBtn) {
            saveReorderSettingsBtn.addEventListener('click', () => this.saveReorderSettings());
        }
        const reorderAllBtn = document.getElementById('reorderAllBtn');
        if (reorderAllBtn) {
            reorderAllBtn.addEventListener('click', () => this.reorderAll());
        }

        // Settings
        const saveStoreInfoBtn = document.getElementById('saveStoreInfoBtn');
        if (saveStoreInfoBtn) saveStoreInfoBtn.addEventListener('click', () => this.saveStoreInfo());
        const saveGeneralBtn = document.getElementById('saveGeneralBtn');
        if (saveGeneralBtn) saveGeneralBtn.addEventListener('click', () => this.saveGeneralSettings());
        const saveLowStockBtn = document.getElementById('saveLowStockBtn');
        if (saveLowStockBtn) saveLowStockBtn.addEventListener('click', () => this.saveLowStockThreshold());
        const saveThemeBtn = document.getElementById('saveThemeBtn');
        if (saveThemeBtn) saveThemeBtn.addEventListener('click', () => this.applyThemeFromSettings());
        const exportDataBtn = document.getElementById('exportDataBtn');
        if (exportDataBtn) exportDataBtn.addEventListener('click', () => this.exportData());
        const backupDataBtn = document.getElementById('backupDataBtn');
        if (backupDataBtn) backupDataBtn.addEventListener('click', () => this.backupData());
        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) clearAllBtn.addEventListener('click', () => this.clearAllData());
        const resetAppBtn = document.getElementById('resetAppBtn');
        if (resetAppBtn) resetAppBtn.addEventListener('click', () => this.resetApp());

        // Add Profile btn in settings
        const addProfileBtn = document.getElementById('addProfileSettingsBtn');
        if (addProfileBtn) addProfileBtn.addEventListener('click', () => this.openAddProfileModal());
        const switchProfileBtn = document.getElementById('switchProfileBtn');
        if (switchProfileBtn) switchProfileBtn.addEventListener('click', () => showProfileScreen());

        // Close modals
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) this.closeModal(modal);
            });
        });
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });

        // Print / Download
        document.getElementById('printBtn').addEventListener('click', () => this.printInvoice());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadInvoicePDF());

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        const mobileThemeBtn = document.getElementById('mobileThemeBtn');
        if (mobileThemeBtn) mobileThemeBtn.addEventListener('click', () => this.toggleTheme());

        const addProductBtn = document.getElementById('addProductBtn');
        if (addProductBtn) addProductBtn.addEventListener('click', () => this.openProductModal());

        // Check for WhatsApp return flag
        const waReturn = sessionStorage.getItem('whatsapp_sent');
        if (waReturn) {
            sessionStorage.removeItem('whatsapp_sent');
            const info = JSON.parse(waReturn);
            setTimeout(() => this.showSentSuccessPanel(info), 500);
        }
    }

    // =====================
    // NAVIGATION
    // =====================
    changePage(pageName) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));

        const pageEl = document.getElementById(pageName);
        if (pageEl) pageEl.classList.add('active');

        const navItem = document.querySelector(`.nav-item[data-page="${pageName}"]`);
        if (navItem) navItem.classList.add('active');

        const titles = {
            'dashboard': 'Dashboard',
            'products': 'Inventory',
            'billing': 'Billing',
            'lowstock': 'Low Stock Alert',
            'settings': 'Settings',
            'invoices': 'Invoices',
            'colorbook': 'Colour Book'
        };
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) pageTitle.textContent = titles[pageName] || 'Dashboard';

        const addBtn = document.getElementById('addProductBtn');
        if (addBtn) addBtn.style.display = pageName === 'products' ? 'flex' : 'none';

        if (pageName === 'dashboard') this.updateDashboard();
        else if (pageName === 'products') this.loadProducts();
        else if (pageName === 'billing') { this.updateProductSelect(); this.switchBillingTab('customer'); }
        else if (pageName === 'lowstock') this.loadLowStockPage();
        else if (pageName === 'settings') this.loadSettings();
        else if (pageName === 'invoices') this.loadInvoices();
        else if (pageName === 'colorbook') this.loadColorBook();
    }

    // =====================
    // DASHBOARD
    // =====================
    updateDashboard() {
        const products = storage.getProducts();
        const invoices = storage.getInvoices();
        const lowStockItems = storage.getLowStockProducts(this.lowStockThreshold);

        document.getElementById('totalProducts').textContent = products.length;
        document.getElementById('lowStockItems').textContent = lowStockItems.length;
        document.getElementById('totalRevenue').textContent = '₹' + storage.getTotalRevenue().toFixed(2);
        document.getElementById('totalInvoices').textContent = invoices.length;

        this.displayRecentInventory();
        this.displayRecentTransactions();
    }

    displayRecentInventory() {
        const products = storage.getProducts().slice(0, 12);
        const container = document.getElementById('recentInventoryGrid');
        if (products.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); padding: 1rem 0;">No products yet. Add your first product!</p>';
            return;
        }
        container.innerHTML = products.map(p => {
            const isLow = p.quantity < this.lowStockThreshold;
            const isOut = p.quantity === 0;
            const statusColor = isOut ? 'var(--pink)' : isLow ? 'orange' : 'var(--green)';
            const statusDot = isOut ? '🔴' : isLow ? '🟡' : '🟢';
            return `
            <div class="inv-slide-card" onclick="app.openProductModal('${p.id}')" title="${p.name}">
                <div class="inv-slide-img">
                    ${p.photo ? `<img src="${p.photo}" alt="${p.name}">` : `<span>📦</span>`}
                </div>
                <div class="inv-slide-name">${p.name}</div>
                <div class="inv-slide-stock" style="color:${statusColor};">${statusDot} ${p.quantity} units</div>
                <div class="inv-slide-price">₹${p.price.toFixed(2)}</div>
            </div>`;
        }).join('');
    }

    displayRecentTransactions() {
        const invoices = storage.getInvoices()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 8);
        const container = document.getElementById('recentTransactionsList');
        if (invoices.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);padding:1rem 0;">No transactions yet</p>';
            return;
        }
        container.innerHTML = invoices.map(inv => {
            const isPurchase = inv.type === 'purchase';
            const party = isPurchase ? (inv.supplierName || 'Supplier') : (inv.customerName || 'Walk-in');
            const amountColor = isPurchase ? '#00c96a' : 'var(--primary)';
            const prefix = isPurchase ? '-' : '+';
            const icon = isPurchase ? '📦' : '💳';
            const typeLabel = isPurchase ? 'Purchase' : (inv.customerType === 'wholesaler' ? '🏪 Wholesale' : '💵 Cash Sale');
            return `
            <div class="txn-slide-card" onclick="${isPurchase ? `app.viewPurchaseInvoice('${inv.id}')` : `app.viewInvoice('${inv.id}')`}">
                <div class="txn-card-icon" style="background:${isPurchase ? 'rgba(0,201,106,0.15)' : 'rgba(108,99,255,0.15)'};">${icon}</div>
                <div class="txn-card-id">${inv.id}</div>
                <div class="txn-card-party">${party}</div>
                <div class="txn-card-type">${typeLabel}</div>
                <div class="txn-card-date">${new Date(inv.createdAt).toLocaleDateString()}</div>
                <div class="txn-card-amount" style="color:${amountColor};">${prefix}₹${(inv.total || 0).toFixed(2)}</div>
            </div>`;
        }).join('');
    }

    // =====================
    // PRODUCTS
    // =====================
    openProductModal(productId = null) {
        this.currentEditingProductId = productId;
        const modal = document.getElementById('productModal');
        const form = document.getElementById('productForm');
        const preview = document.getElementById('photoPreview');
        form.reset();
        preview.innerHTML = '';
        this.photoBase64 = null;
        this.productColors = [];
        this.renderColorTags();

        if (productId) {
            const p = storage.getProductById(productId);
            document.getElementById('modalTitle').textContent = 'Edit Product';
            document.getElementById('productName').value = p.name;
            document.getElementById('productSKU').value = p.sku;
            document.getElementById('productCategory').value = p.category || '';
            document.getElementById('productPrice').value = p.price;
            document.getElementById('productWholesalePrice').value = p.wholesalePrice || p.price;
            document.getElementById('productQuantity').value = p.quantity;
            document.getElementById('productDescription').value = p.description || '';
            this.productColors = Array.isArray(p.colors)
                ? p.colors.map(c => typeof c === 'string' ? { name: c, qty: 0 } : c)
                : [];
            this.renderColorTags();
            if (p.photo) {
                preview.innerHTML = `<img src="${p.photo}" alt="${p.name}">`;
                this.photoBase64 = p.photo;
            }
        } else {
            document.getElementById('modalTitle').textContent = 'Add New Product';
        }
        modal.classList.add('active');
    }

    addColorToProduct() {
        const input = document.getElementById('colorInput');
        const qtyInput = document.getElementById('colorQtyInput');
        const val = input.value.trim();
        if (!val) return;
        if (this.productColors.find(c => c.name.toLowerCase() === val.toLowerCase())) {
            this.showNotification('Colour already added', 'warning');
            return;
        }
        const qty = parseInt(qtyInput ? qtyInput.value : 0) || 0;
        this.productColors.push({ name: val, qty });
        input.value = '';
        if (qtyInput) qtyInput.value = 0;
        this.renderColorTags();
        // Auto-update total quantity field as sum of color qtys
        this._syncTotalQtyFromColors();
    }

    _syncTotalQtyFromColors() {
        const total = this.productColors.reduce((s, c) => s + (c.qty || 0), 0);
        if (total > 0) {
            const qtyField = document.getElementById('productQuantity');
            if (qtyField) qtyField.value = total;
        }
    }

    removeColorFromProductModal(idx) {
        this.productColors.splice(idx, 1);
        this.renderColorTags();
        this._syncTotalQtyFromColors();
    }

    renderColorTags() {
        const container = document.getElementById('colorTagsContainer');
        if (!container) return;
        if (this.productColors.length === 0) {
            container.innerHTML = '<span style="color:var(--text-muted);font-size:0.8rem;">No colours added yet</span>';
            return;
        }
        container.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem;margin-top:0.25rem;">
            <thead>
                <tr style="color:var(--text-muted);font-size:0.75rem;">
                    <th style="text-align:left;padding:0.3rem 0.4rem;font-weight:600;">Colour</th>
                    <th style="text-align:center;padding:0.3rem 0.4rem;font-weight:600;">Stock</th>
                    <th style="text-align:center;padding:0.3rem 0.4rem;"></th>
                </tr>
            </thead>
            <tbody>
            ${this.productColors.map((c, i) => {
                const name = typeof c === 'string' ? c : c.name;
                const qty = typeof c === 'string' ? 0 : (c.qty || 0);
                const swatch = this.getColorSwatch(name);
                return `<tr style="background:var(--bg-secondary);border-radius:6px;">
                    <td style="padding:0.4rem 0.5rem;border-radius:6px 0 0 6px;">
                        <div style="display:flex;align-items:center;gap:0.4rem;">
                            <span style="width:13px;height:13px;border-radius:50%;background:${swatch};display:inline-block;border:1px solid rgba(255,255,255,0.3);flex-shrink:0;"></span>
                            <span style="color:var(--text-light);">${name}</span>
                        </div>
                    </td>
                    <td style="padding:0.4rem 0.5rem;text-align:center;">
                        <input type="number" min="0" value="${qty}"
                            style="width:64px;padding:0.25rem 0.3rem;font-size:0.83rem;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);text-align:center;"
                            onchange="app.updateColorQty(${i}, this.value)">
                    </td>
                    <td style="padding:0.4rem 0.4rem;text-align:center;border-radius:0 6px 6px 0;">
                        <button onclick="app.removeColorFromProductModal(${i})" style="background:none;border:none;color:var(--pink);cursor:pointer;font-size:0.9rem;padding:0;">✕</button>
                    </td>
                </tr><tr style="height:4px;"><td colspan="3"></td></tr>`;
            }).join('')}
            </tbody>
        </table>`;
    }

    updateColorQty(idx, val) {
        const qty = parseInt(val) || 0;
        if (this.productColors[idx]) {
            if (typeof this.productColors[idx] === 'string') {
                this.productColors[idx] = { name: this.productColors[idx], qty };
            } else {
                this.productColors[idx].qty = qty;
            }
        }
        this._syncTotalQtyFromColors();
    }

    // Full colour chart palette — matches the uploaded chart exactly
    _getColorChartData() {
        return [
            { group: 'Red', colors: [
                { name: 'Light Red',     hex: '#f9a8a8' },
                { name: 'Salmon',        hex: '#f4a07a' },
                { name: 'Coral',         hex: '#f07050' },
                { name: 'Strawberry',    hex: '#e8354a' },
                { name: 'Red',           hex: '#e00000' },
                { name: 'Brick Red',     hex: '#b83020' },
                { name: 'Dark Red',      hex: '#8b1010' },
                { name: 'Maroon',        hex: '#660000' },
            ]},
            { group: 'Orange', colors: [
                { name: 'Pale Orange',   hex: '#fdd5a8' },
                { name: 'Light Orange',  hex: '#fbb86a' },
                { name: 'Marigold',      hex: '#f5a030' },
                { name: 'Grapefruit',    hex: '#f08030' },
                { name: 'Tangerine',     hex: '#f07020' },
                { name: 'Orange',        hex: '#e86000' },
                { name: 'Dark Orange',   hex: '#c84800' },
                { name: 'Orange Red',    hex: '#e04818' },
            ]},
            { group: 'Yellow', colors: [
                { name: 'Cream',         hex: '#fdf5d8' },
                { name: 'Light Yellow',  hex: '#fdf5b0' },
                { name: 'Butter Yellow', hex: '#fdf090' },
                { name: 'Lemon Yellow',  hex: '#fef060' },
                { name: 'Honey',         hex: '#f8d840' },
                { name: 'Bright Yellow', hex: '#ffe000' },
                { name: 'Yellow',        hex: '#f0c800' },
                { name: 'Dark Yellow',   hex: '#d4a000' },
            ]},
            { group: 'Green', colors: [
                { name: 'Pale Green',    hex: '#c8e8c0' },
                { name: 'Light Green',   hex: '#88cc88' },
                { name: 'Lime Green',    hex: '#88d048' },
                { name: 'Cool Green',    hex: '#50b870' },
                { name: 'Bright Green',  hex: '#20b840' },
                { name: 'Green',         hex: '#008020' },
                { name: 'Forest Green',  hex: '#186030' },
                { name: 'Dark Green',    hex: '#104828' },
            ]},
            { group: 'Blue', colors: [
                { name: 'Light Blue',    hex: '#bcd8f8' },
                { name: 'Sky Blue',      hex: '#78b8e8' },
                { name: 'Sea Blue',      hex: '#50a0d0' },
                { name: 'Bright Blue',   hex: '#2880e0' },
                { name: 'Blue',          hex: '#0050e0' },
                { name: 'Medium Blue',   hex: '#0040b0' },
                { name: 'Dark Blue',     hex: '#003090' },
                { name: 'Navy Blue',     hex: '#001868' },
            ]},
            { group: 'Purple', colors: [
                { name: 'Light Purple',  hex: '#d0b0e8' },
                { name: 'Lavender',      hex: '#b090d8' },
                { name: 'Medium Purple', hex: '#9060d0' },
                { name: 'Grape',         hex: '#6830c0' },
                { name: 'Orchid',        hex: '#8840b0' },
                { name: 'Purple',        hex: '#700898' },
                { name: 'Indigo',        hex: '#500890' },
                { name: 'Dark Purple',   hex: '#380870' },
            ]},
            { group: 'Pink', colors: [
                { name: 'Light Pink',    hex: '#ffd0d8' },
                { name: 'Peach',         hex: '#ffb0a0' },
                { name: 'Pink',          hex: '#f880a0' },
                { name: 'Bright Pink',   hex: '#f85090' },
                { name: 'Rose Pink',     hex: '#f06080' },
                { name: 'Hot Pink',      hex: '#e80070' },
                { name: 'Magenta',       hex: '#d00090' },
                { name: 'Dark Pink',     hex: '#b00050' },
            ]},
            { group: 'Brown', colors: [
                { name: 'Light Brown',   hex: '#e8c8b0' },
                { name: 'Tan',           hex: '#d4a878' },
                { name: 'Terracotta',    hex: '#c07858' },
                { name: 'Reddish Brown', hex: '#a05838' },
                { name: 'Caramel',       hex: '#a06820' },
                { name: 'Brown',         hex: '#784010' },
                { name: 'Wood',          hex: '#604020' },
                { name: 'Dark Brown',    hex: '#401800' },
            ]},
            { group: 'Grey', colors: [
                { name: 'White',         hex: '#ffffff' },
                { name: 'Light Grey',    hex: '#dcdcdc' },
                { name: 'Cloud Grey',    hex: '#c8c8c8' },
                { name: 'Cool Grey',     hex: '#b0b8c0' },
                { name: 'Warm Grey',     hex: '#b0a8a0' },
                { name: 'Dove Grey',     hex: '#989090' },
                { name: 'Ash',           hex: '#787878' },
                { name: 'Brownish Grey', hex: '#686058' },
                { name: 'Dark Grey',     hex: '#484040' },
                { name: 'Black',         hex: '#101010' },
            ]},
        ];
    }

    openColorChartPicker() {
        const existing = document.getElementById('colorChartModal');
        if (existing) { existing.remove(); return; }

        const chart = this._getColorChartData();

        const groupsHtml = chart.map(group => `
            <div style="margin-bottom:1rem;">
                <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);letter-spacing:0.06em;margin-bottom:0.45rem;">${group.group.toUpperCase()}</div>
                <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:5px;">
                    ${group.colors.map(c => `
                        <div onclick="app._selectColorFromChart('${c.name}','${c.hex}')"
                            title="${c.name}"
                            style="cursor:pointer;border-radius:6px;aspect-ratio:1;background:${c.hex};border:2px solid transparent;transition:transform 0.1s,border-color 0.1s;box-shadow:0 1px 3px rgba(0,0,0,0.25);"
                            onmouseover="this.style.transform='scale(1.18)';this.style.borderColor='white';this.style.zIndex=2;this.style.position='relative';"
                            onmouseout="this.style.transform='scale(1)';this.style.borderColor='transparent';this.style.zIndex=0;">
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        const modal = document.createElement('div');
        modal.id = 'colorChartModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:flex-end;justify-content:center;padding:0;';
        modal.innerHTML = `
            <div style="background:var(--bg-primary);border-radius:20px 20px 0 0;width:100%;max-width:560px;max-height:82vh;overflow-y:auto;padding:1.25rem 1.25rem 2rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;position:sticky;top:0;background:var(--bg-primary);padding-bottom:0.75rem;border-bottom:1px solid var(--border);">
                    <div>
                        <div style="font-weight:700;font-size:1rem;color:var(--text-light);">🎨 Colour Chart</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.1rem;">Tap a colour → enter quantity → save</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <div id="colorChartPreview" style="display:none;align-items:center;gap:0.4rem;background:var(--bg-secondary);border-radius:8px;padding:0.3rem 0.6rem;">
                            <span id="colorChartPreviewSwatch" style="width:14px;height:14px;border-radius:50%;display:inline-block;border:1px solid rgba(255,255,255,0.3);"></span>
                            <span id="colorChartPreviewName" style="font-size:0.8rem;color:var(--text-light);"></span>
                        </div>
                        <button onclick="document.getElementById('colorChartModal').remove()" style="background:var(--bg-secondary);border:none;color:var(--text-muted);border-radius:8px;padding:0.4rem 0.65rem;cursor:pointer;font-size:1rem;">✕</button>
                    </div>
                </div>
                ${groupsHtml}
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    _selectColorFromChart(name, hex) {
        // Check duplicate
        if (this.productColors.find(c => (typeof c === 'string' ? c : c.name).toLowerCase() === name.toLowerCase())) {
            this.showNotification(`${name} already added`, 'warning');
            return;
        }

        // Show quantity prompt overlay inside the color chart modal
        const existing = document.getElementById('colorQtyPrompt');
        if (existing) existing.remove();

        const prompt = document.createElement('div');
        prompt.id = 'colorQtyPrompt';
        prompt.style.cssText = `
            position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;
            background:rgba(0,0,0,0.55);padding:1rem;
        `;
        prompt.innerHTML = `
            <div style="background:var(--bg-primary);border-radius:18px;padding:1.5rem 1.25rem 1.25rem;width:100%;max-width:340px;box-shadow:0 8px 32px rgba(0,0,0,0.45);border:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.1rem;">
                    <span style="width:32px;height:32px;border-radius:50%;background:${hex};display:inline-block;border:2px solid rgba(255,255,255,0.3);flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></span>
                    <div>
                        <div style="font-weight:700;color:var(--text-light);font-size:1rem;">${name}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);">How many pieces?</div>
                    </div>
                </div>
                <div style="margin-bottom:1rem;">
                    <label style="font-size:0.78rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:0.4rem;">QUANTITY (pieces)</label>
                    <input id="colorQtyPromptInput" type="number" min="0" value="" placeholder="e.g. 50"
                        style="width:100%;padding:0.65rem 0.75rem;font-size:1.1rem;font-weight:600;background:var(--bg-secondary);border:1.5px solid var(--primary);border-radius:10px;color:var(--text-light);text-align:center;box-sizing:border-box;outline:none;">
                </div>
                <div style="display:flex;flex-direction:column;gap:0.5rem;">
                    <button id="colorQtyPromptAddAnother"
                        style="width:100%;padding:0.65rem;background:var(--bg-secondary);border:1.5px solid var(--primary);border-radius:10px;color:var(--primary);font-size:0.9rem;font-weight:700;cursor:pointer;">
                        ✅ Save &amp; Add Another Colour
                    </button>
                    <button id="colorQtyPromptDone"
                        style="width:100%;padding:0.65rem;background:var(--primary);border:none;border-radius:10px;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;">
                        ✔ Save &amp; Close Colour Chart
                    </button>
                    <button id="colorQtyPromptCancel"
                        style="width:100%;padding:0.5rem;background:none;border:none;color:var(--text-muted);font-size:0.82rem;cursor:pointer;">
                        Cancel
                    </button>
                </div>
            </div>`;
        document.body.appendChild(prompt);

        // Focus input
        const qtyInput = document.getElementById('colorQtyPromptInput');
        setTimeout(() => qtyInput.focus(), 80);

        const saveColor = () => {
            const qty = parseInt(qtyInput.value) || 0;
            this.productColors.push({ name, qty, hex });
            this.renderColorTags();
            this._syncTotalQtyFromColors();
            this.showNotification(`✓ ${name} (${qty} pcs) added`, 'success');
            prompt.remove();
        };

        document.getElementById('colorQtyPromptAddAnother').addEventListener('click', () => {
            saveColor();
            // Keep color chart open so user can pick another
        });

        document.getElementById('colorQtyPromptDone').addEventListener('click', () => {
            saveColor();
            // Close color chart too
            document.getElementById('colorChartModal')?.remove();
        });

        document.getElementById('colorQtyPromptCancel').addEventListener('click', () => {
            prompt.remove();
        });

        // Enter key = Save & close
        qtyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveColor();
                document.getElementById('colorChartModal')?.remove();
            }
        });

        // Click outside = cancel
        prompt.addEventListener('click', (e) => {
            if (e.target === prompt) prompt.remove();
        });
    }

    getColorSwatch(colorName) {
        // First check the full chart data for exact match
        const chart = this._getColorChartData();
        for (const group of chart) {
            const found = group.colors.find(c => c.name.toLowerCase() === colorName.toLowerCase().trim());
            if (found) return found.hex;
        }
        // Fallback map for generic names
        const map = {
            red: '#e00000', blue: '#0050e0', green: '#008020', yellow: '#f0c800',
            orange: '#e86000', purple: '#700898', pink: '#f880a0', white: '#ffffff',
            black: '#101010', grey: '#787878', gray: '#787878', brown: '#784010',
            cyan: '#06b6d4', teal: '#14b8a6', navy: '#001868', maroon: '#660000',
            gold: '#d4a000', silver: '#b0b8c0', beige: '#fdf5d8', cream: '#fdf5d8',
            lavender: '#b090d8', rose: '#f06080', violet: '#8840b0', indigo: '#500890',
            lime: '#88d048', mint: '#6ee7b7', coral: '#f07050', peach: '#ffb0a0',
            sky: '#78b8e8', magenta: '#d00090', olive: '#84823c', turquoise: '#2dd4bf',
            salmon: '#f4a07a', tan: '#d4a878', terracotta: '#c07858', caramel: '#a06820',
        };
        const lower = colorName.toLowerCase().trim();
        if (map[lower]) return map[lower];
        // If a hex was stored directly
        if (/^#[0-9a-f]{3,6}$/i.test(lower)) return lower;
        try {
            const el = document.createElement('div');
            el.style.color = lower;
            if (el.style.color) return lower;
        } catch(e) {}
        return '#8892b0';
    }

    previewPhoto(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('photoPreview').innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            this.photoBase64 = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    openCamera() {
        const modal = document.getElementById('cameraModal');
        modal.classList.add('active');
        document.getElementById('captureBtn').style.display = 'inline-flex';
        document.getElementById('retakeBtn').style.display = 'none';

        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                this.cameraStream = stream;
                document.getElementById('cameraFeed').srcObject = stream;
            })
            .catch(() => {
                this.showNotification('Camera access denied. Use Upload instead.', 'warning');
                modal.classList.remove('active');
            });
    }

    capturePhoto() {
        const video = document.getElementById('cameraFeed');
        const canvas = document.getElementById('photoCanvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        this.photoBase64 = canvas.toDataURL('image/jpeg', 0.8);
        document.getElementById('photoPreview').innerHTML = `<img src="${this.photoBase64}" alt="Preview">`;
        document.getElementById('captureBtn').style.display = 'none';
        document.getElementById('retakeBtn').style.display = 'inline-flex';
        this.showNotification('Photo captured!', 'success');
    }

    retakePhoto() {
        if (this.cameraStream) this.cameraStream.getTracks().forEach(t => t.stop());
        this.openCamera();
    }

    closeCamera() {
        document.getElementById('cameraModal').classList.remove('active');
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(t => t.stop());
            this.cameraStream = null;
        }
    }

    handleProductSubmit(e) {
        e.preventDefault();
        const productData = {
            name: document.getElementById('productName').value,
            sku: document.getElementById('productSKU').value,
            category: document.getElementById('productCategory').value,
            price: parseFloat(document.getElementById('productPrice').value),
            wholesalePrice: parseFloat(document.getElementById('productWholesalePrice').value),
            quantity: parseInt(document.getElementById('productQuantity').value),
            description: document.getElementById('productDescription').value,
            photo: this.photoBase64 || null,
            colors: this.productColors.map(c =>
                typeof c === 'string' ? { name: c, qty: 0 } : c
            )
        };

        if (this.currentEditingProductId) {
            storage.updateProduct(this.currentEditingProductId, productData);
            this.showNotification('Product updated!', 'success');
        } else {
            storage.addProduct(productData);
            this.showNotification('Product added!', 'success');
        }

        this.closeModal(document.getElementById('productModal'));
        this.loadProducts();
        this.updateProductSelect();
        this.photoBase64 = null;
        this.productColors = [];
    }

    loadProducts() {
        this.displayProducts(storage.getProducts());
    }

    displayProducts(products) {
        const container = document.getElementById('productsList');
        if (products.length === 0) {
            container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:2rem;">No products found. Add your first product!</p>';
            return;
        }
        container.innerHTML = products.map(p => {
            const isLow = p.quantity < this.lowStockThreshold;
            const isOut = p.quantity === 0;
            const statusClass = isOut ? 'stock-low' : isLow ? 'stock-low' : 'stock-ok';
            const statusText = isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock';
            const colorsHtml = (p.colors && p.colors.length > 0)
                ? `<div class="product-colors" style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.4rem;">
                    ${p.colors.map(c => {
                        const name = typeof c === 'string' ? c : c.name;
                        const qty = typeof c === 'string' ? null : c.qty;
                        return `<span title="${name}${qty !== null ? ': ' + qty + ' units' : ''}" style="width:16px;height:16px;border-radius:50%;background:${this.getColorSwatch(name)};display:inline-block;border:1.5px solid rgba(255,255,255,0.3);cursor:default;"></span>`;
                    }).join('')}
                   </div>`
                : '';
            return `
            <div class="product-card">
                <div class="product-image">
                    ${p.photo ? `<img src="${p.photo}" alt="${p.name}">` : '📦'}
                </div>
                <div class="product-info">
                    <div class="product-name">${p.name}</div>
                    <div class="product-sku">SKU: ${p.sku}</div>
                    <div class="product-prices">
                        <div class="price-row">
                            <span class="price-label">Selling:</span>
                            <span class="price-value">₹${p.price.toFixed(2)}</span>
                        </div>
                        <div class="price-row">
                            <span class="price-label">Wholesale:</span>
                            <span class="price-value-secondary">₹${(p.wholesalePrice || p.price).toFixed(2)}</span>
                        </div>
                    </div>
                    ${colorsHtml}
                    <div class="product-stock ${statusClass}">${p.quantity} units — ${statusText}</div>
                    <div class="product-actions">
                        <button class="btn btn-small btn-primary" onclick="app.addProductToBilling('${p.id}')" ${p.quantity === 0 ? 'disabled' : ''}>💳 Bill</button>
                        <button class="btn btn-small btn-secondary" onclick="app.openProductModal('${p.id}')">✏️ Edit</button>
                        <button class="btn btn-small btn-danger" onclick="app.deleteProduct('${p.id}')">🗑️</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    searchProducts(query) {
        const results = query ? storage.searchProducts(query) : storage.getProducts();
        this.displayProducts(results);
    }

    deleteProduct(id) {
        if (confirm('Delete this product?')) {
            storage.deleteProduct(id);
            this.loadProducts();
            this.showNotification('Product deleted.', 'success');
        }
    }

    // =====================
    // COLOUR BOOK
    // =====================
    loadColorBook() {
        const products = storage.getProducts();
        const container = document.getElementById('colorBookContent');
        if (!container) return;

        const withColors = products.filter(p => p.colors && p.colors.length > 0);
        if (withColors.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);">🎨 No products with colours yet.<br>Add colours to your products in the Inventory section.</div>';
            return;
        }

        // Check if any product has out-of-stock colours
        const hasAnyOutOfStock = withColors.some(p =>
            p.colors.some(c => (typeof c === 'string' ? 0 : (c.qty || 0)) === 0)
        );

        container.innerHTML = withColors.map(p => {
            const inStockColors = p.colors.filter(c => (typeof c === 'string' ? 1 : (c.qty || 0)) > 0);
            const outOfStockColors = p.colors.filter(c => (typeof c === 'string' ? false : (c.qty || 0)) === 0);

            const renderColorChip = (c, isOut) => {
                const name = typeof c === 'string' ? c : c.name;
                const qty = typeof c === 'string' ? null : c.qty;
                const swatch = this.getColorSwatch(name);
                if (isOut) {
                    return `
                    <div style="position:relative;display:flex;align-items:center;gap:0.45rem;background:rgba(239,68,68,0.07);border:1.5px solid rgba(239,68,68,0.35);border-radius:20px;padding:0.3rem 0.75rem;opacity:0.85;">
                        <span style="width:14px;height:14px;border-radius:50%;background:${swatch};display:inline-block;border:1.5px solid rgba(255,255,255,0.2);flex-shrink:0;filter:grayscale(40%);"></span>
                        <span style="font-size:0.82rem;color:var(--text-muted);text-decoration:line-through;">${name}</span>
                        <span style="font-size:0.7rem;font-weight:700;color:var(--pink);white-space:nowrap;">Out of Stock</span>
                        <button onclick="app._reorderSingleColor('${p.id}','${name}')"
                            title="Reorder ${name}"
                            style="margin-left:0.2rem;background:rgba(108,99,255,0.18);border:none;border-radius:10px;padding:0.15rem 0.45rem;color:var(--primary);font-size:0.7rem;cursor:pointer;white-space:nowrap;font-weight:600;">↺ Reorder</button>
                    </div>`;
                }
                return `
                <div style="display:flex;align-items:center;gap:0.45rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:20px;padding:0.3rem 0.75rem;">
                    <span style="width:14px;height:14px;border-radius:50%;background:${swatch};display:inline-block;border:1.5px solid rgba(255,255,255,0.25);flex-shrink:0;"></span>
                    <span style="font-size:0.82rem;color:var(--text-light);">${name}</span>
                    ${qty !== null ? `<span style="font-size:0.75rem;color:var(--text-muted);">· ${qty}</span>` : ''}
                </div>`;
            };

            const totalColors = p.colors.length;
            const outCount = outOfStockColors.length;
            const inCount = inStockColors.length;

            return `
            <div class="card" style="margin-bottom:1rem;${outCount > 0 && inCount === 0 ? 'border-left:3px solid rgba(239,68,68,0.5);' : outCount > 0 ? 'border-left:3px solid rgba(251,146,60,0.5);' : ''}">
                <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
                    <div style="width:56px;height:56px;border-radius:10px;overflow:hidden;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;border:1px solid var(--border);">
                        ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;">` : '📦'}
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;color:var(--cyan);margin-bottom:0.2rem;">${p.name}</div>
                        <div style="font-size:0.78rem;color:var(--text-muted);">SKU: ${p.sku} · Total stock: ${p.quantity} units</div>
                        <div style="font-size:0.75rem;margin-top:0.2rem;">
                            ${inCount > 0 ? `<span style="color:var(--green);">✓ ${inCount} colour${inCount>1?'s':''} in stock</span>` : ''}
                            ${inCount > 0 && outCount > 0 ? '<span style="color:var(--text-muted);margin:0 0.3rem;">·</span>' : ''}
                            ${outCount > 0 ? `<span style="color:var(--pink);">⚠️ ${outCount} sold out</span>` : ''}
                        </div>
                    </div>
                    <button class="btn btn-small btn-secondary" onclick="app.openProductModal('${p.id}')">✏️ Edit</button>
                </div>

                ${inStockColors.length > 0 ? `
                <div style="margin-top:0.85rem;">
                    <div style="font-size:0.72rem;color:var(--text-muted);font-weight:600;letter-spacing:0.04em;margin-bottom:0.5rem;">✅ IN STOCK</div>
                    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
                        ${inStockColors.map(c => renderColorChip(c, false)).join('')}
                    </div>
                </div>` : ''}

                ${outOfStockColors.length > 0 ? `
                <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px dashed rgba(239,68,68,0.25);">
                    <div style="font-size:0.72rem;color:var(--pink);font-weight:600;letter-spacing:0.04em;margin-bottom:0.5rem;">🔴 OUT OF STOCK — tap ↺ Reorder to replenish</div>
                    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
                        ${outOfStockColors.map(c => renderColorChip(c, true)).join('')}
                    </div>
                </div>` : ''}
            </div>`;
        }).join('');
    }

    // Quick single-colour reorder shortcut from colour book
    _reorderSingleColor(productId, colorName) {
        const p = storage.getProductById(productId);
        if (!p) return;
        this._pendingReorderProducts = [p];
        // Open colour picker pre-set to just this colour
        this._showReorderColorPickerForColor(p, colorName);
    }

    _showReorderColorPickerForColor(product, targetColorName) {
        const existing = document.getElementById('reorderColorPickerModal');
        if (existing) existing.remove();
        const defaultQty = parseInt(localStorage.getItem('defaultReorderQty')) || 50;
        this._pendingReorderProducts = [product];

        const allColors = (product.colors && product.colors.length > 0) ? product.colors : [];

        const colorRows = allColors.map((c, ci) => {
            const name = typeof c === 'string' ? c : c.name;
            const currentStock = typeof c === 'string' ? 0 : (c.qty || 0);
            const swatch = this.getColorSwatch(name);
            const isTarget = name.toLowerCase() === targetColorName.toLowerCase();
            const isZero = currentStock === 0;
            return `
            <div style="display:flex;align-items:center;gap:0.6rem;background:var(--bg-primary);border-radius:8px;padding:0.5rem 0.75rem;border:${isTarget ? '1.5px solid var(--primary)' : '1px solid var(--border)'};margin-bottom:0.4rem;${isTarget ? 'box-shadow:0 0 0 2px rgba(108,99,255,0.15);' : ''}">
                <span style="width:13px;height:13px;border-radius:50%;background:${swatch};flex-shrink:0;border:1.5px solid rgba(255,255,255,0.25);"></span>
                <span style="flex:1;font-size:0.86rem;color:${isTarget ? 'var(--text-light)' : 'var(--text-muted)'};">${name}${isTarget ? ' <span style="font-size:0.7rem;color:var(--primary);font-weight:700;">← sold out</span>' : ''}</span>
                <span style="font-size:0.75rem;${isZero ? 'color:var(--pink);font-weight:700;' : 'color:var(--text-muted);'}">Stock: ${currentStock}</span>
                <input type="number" min="0" value="${isTarget ? defaultQty : 0}"
                    data-product-idx="0" data-color-name="${name}"
                    id="rcp_0_${ci}"
                    style="width:72px;padding:0.3rem 0.4rem;font-size:0.84rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);text-align:center;"
                    oninput="app._updateReorderColorTotal(0)">
            </div>`;
        }).join('');

        const modal = document.createElement('div');
        modal.id = 'reorderColorPickerModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:480px;max-height:90vh;overflow-y:auto;">
                <span class="close" onclick="document.getElementById('reorderColorPickerModal').remove()">×</span>
                <div style="text-align:center;margin-bottom:1.25rem;">
                    <div style="font-size:2rem;margin-bottom:0.4rem;">🔴 📦</div>
                    <h2 style="color:var(--cyan);">Reorder Sold-Out Colour</h2>
                    <p style="color:var(--text-muted);font-size:0.85rem;"><strong style="color:var(--primary);">${targetColorName}</strong> is out of stock for <strong>${product.name}</strong>.<br>Adjust quantities below and continue.</p>
                </div>
                <div style="background:var(--bg-secondary);border-radius:12px;padding:1rem;margin-bottom:1rem;border:1px solid var(--border);">
                    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.85rem;">
                        ${product.photo ? `<img src="${product.photo}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;flex-shrink:0;">` : `<div style="width:40px;height:40px;background:var(--bg-primary);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;">📦</div>`}
                        <div>
                            <div style="font-weight:700;color:var(--cyan);">${product.name}</div>
                            <div style="font-size:0.75rem;color:var(--text-muted);">Adjust qty to 0 for colours you don't want to reorder</div>
                        </div>
                        <div style="margin-left:auto;text-align:right;font-size:0.8rem;color:var(--text-muted);">Total:<br><strong id="rcp_total_0" style="color:var(--primary);font-size:1rem;">${defaultQty}</strong></div>
                    </div>
                    ${colorRows}
                </div>
                <div style="display:flex;gap:0.75rem;">
                    <button class="btn btn-secondary" style="flex:1;" onclick="document.getElementById('reorderColorPickerModal').remove()">Cancel</button>
                    <button class="btn btn-primary" style="flex:2;" onclick="app._confirmReorderColorPicker()">📦 Continue to Reorder →</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    // =====================
    // BILLING
    // =====================
    addProductToBilling(productId) {
        this.pendingBillingProductId = productId;
        const p = storage.getProductById(productId);
        if (!p) return;

        document.getElementById('quantityProductName').textContent = p.name;
        document.getElementById('quantityProductPrice').textContent = '₹' + p.price.toFixed(2);
        document.getElementById('quantityProductStock').textContent = p.quantity + ' units';

        const hasColors = p.colors && p.colors.length > 0;
        const simpleRow = document.getElementById('quantitySimpleRow');
        const colorSection = document.getElementById('quantityColorSection');

        if (hasColors) {
            simpleRow.style.display = 'none';
            colorSection.style.display = 'block';
            this._renderColorQtyRows(p);
        } else {
            simpleRow.style.display = 'block';
            colorSection.style.display = 'none';
            document.getElementById('quantityInput').value = 1;
            document.getElementById('quantityInput').max = p.quantity;
        }

        document.getElementById('quantitySelectorModal').classList.add('active');
    }

    _renderColorQtyRows(product) {
        const container = document.getElementById('colorQtyRows');
        container.innerHTML = product.colors.map((c, i) => {
            const name = typeof c === 'string' ? c : c.name;
            const stock = typeof c === 'string' ? product.quantity : (c.qty || 0);
            const swatch = this.getColorSwatch(name);
            return `
            <div style="display:flex;align-items:center;gap:0.6rem;background:var(--bg-secondary);border-radius:8px;padding:0.5rem 0.75rem;border:1px solid var(--border);">
                <span style="width:14px;height:14px;border-radius:50%;background:${swatch};flex-shrink:0;border:1.5px solid rgba(255,255,255,0.25);"></span>
                <span style="flex:1;font-size:0.88rem;color:var(--text-light);">${name}</span>
                <span style="font-size:0.75rem;color:var(--text-muted);">Stock: <strong style="color:${stock===0?'var(--pink)':'var(--cyan)'};">${stock}</strong></span>
                <input type="number" id="billingColorQty_${i}" min="0" max="${stock}" value="0" ${stock===0?'disabled':''}
                    style="width:64px;padding:0.3rem 0.4rem;font-size:0.85rem;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);text-align:center;"
                    oninput="app._validateColorQtyRows()" data-colorname="${name}" data-stock="${stock}">
            </div>`;
        }).join('');
        document.getElementById('colorQtyValidation').innerHTML = '';
    }

    _validateColorQtyRows() {
        const inputs = document.querySelectorAll('#colorQtyRows input[type=number]');
        const validation = document.getElementById('colorQtyValidation');
        let hasError = false;
        let totalQty = 0;
        inputs.forEach(inp => {
            const val = parseInt(inp.value) || 0;
            const stock = parseInt(inp.dataset.stock) || 0;
            totalQty += val;
            if (val > stock) {
                inp.style.borderColor = 'var(--pink)';
                hasError = true;
            } else {
                inp.style.borderColor = val > 0 ? 'var(--cyan)' : 'var(--border)';
            }
        });
        if (hasError) {
            validation.innerHTML = '<span style="color:var(--pink);">⚠️ Quantity exceeds available stock for one or more colours.</span>';
        } else if (totalQty === 0) {
            validation.innerHTML = '<span style="color:var(--text-muted);">Enter quantity for at least one colour.</span>';
        } else {
            validation.innerHTML = `<span style="color:var(--cyan);">✓ Total: ${totalQty} unit${totalQty > 1 ? 's' : ''} selected.</span>`;
        }
        return !hasError && totalQty > 0;
    }

    confirmAddToBilling() {
        const p = storage.getProductById(this.pendingBillingProductId);
        if (!p) return;

        const hasColors = p.colors && p.colors.length > 0;

        if (hasColors) {
            // Validate color qty rows
            if (!this._validateColorQtyRows()) {
                this.showNotification('Fix quantities before adding to bill', 'warning');
                return;
            }
            const inputs = document.querySelectorAll('#colorQtyRows input[type=number]');
            const entries = [];
            inputs.forEach(inp => {
                const qty = parseInt(inp.value) || 0;
                if (qty > 0) entries.push({ color: inp.dataset.colorname, qty });
            });
            if (entries.length === 0) {
                this.showNotification('Select at least one colour with qty > 0', 'warning');
                return;
            }

            this.closeModal(document.getElementById('quantitySelectorModal'));
            this.changePage('billing');
            this.switchBillingTab('cart');

            entries.forEach(({ color, qty }) => {
                this.addToCartWithColor(this.pendingBillingProductId, qty, color);
            });

        } else {
            const qty = parseInt(document.getElementById('quantityInput').value);
            if (!qty || qty < 1) { this.showNotification('Enter a valid quantity', 'warning'); return; }
            if (qty > p.quantity) { this.showNotification('Not enough stock!', 'error'); return; }

            this.closeModal(document.getElementById('quantitySelectorModal'));
            this.changePage('billing');
            this.switchBillingTab('cart');
            this.addToCartWithColor(this.pendingBillingProductId, qty, '');
        }

        this.pendingBillingProductId = null;
    }

    updateProductSelect() {
        const select = document.getElementById('productSelect');
        const products = storage.getProducts().filter(p => p.quantity > 0);
        select.innerHTML = '<option value="">Select a product...</option>' +
            products.map(p => `<option value="${p.id}">${p.name} (₹${p.price.toFixed(2)}) — ${p.quantity} left</option>`).join('');
    }

    addToCart() {
        const productId = document.getElementById('productSelect').value;
        const qty = parseInt(document.getElementById('itemQuantity').value) || 1;
        if (!productId) { this.showNotification('Select a product first', 'warning'); return; }
        this.addToCartWithColor(productId, qty, '');
    }

    addToCartWithColor(productId, qty, color) {
        const product = storage.getProductById(productId);
        if (!product) return;

        // Determine available stock for this color
        let availableStock = product.quantity;
        if (color && product.colors && product.colors.length > 0) {
            const colorObj = product.colors.find(c => {
                const name = typeof c === 'string' ? c : c.name;
                return name.toLowerCase() === color.toLowerCase();
            });
            if (colorObj && typeof colorObj !== 'string') {
                availableStock = colorObj.qty || 0;
            }
        }

        // Check for existing same product+color combo in cart
        const existing = this.cartItems.find(i => i.id === productId && (i.selectedColor || '') === (color || ''));
        const totalQty = (existing ? existing.cartQuantity : 0) + qty;
        if (totalQty > availableStock) {
            this.showNotification(`Not enough stock for ${color || product.name}! (${availableStock} available)`, 'error');
            return;
        }

        if (existing) {
            existing.cartQuantity += qty;
        } else {
            this.cartItems.push({ ...product, cartQuantity: qty, selectedColor: color || '', _colorStock: availableStock });
        }
        this.renderCart();
        document.getElementById('itemQuantity').value = 1;
        this.showNotification(`${product.name}${color ? ' (' + color + ')' : ''} added to cart`, 'success');
    }

    renderCart() {
        const tbody = document.getElementById('cartItems');
        if (this.cartItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1rem;">Cart is empty</td></tr>';
            document.getElementById('totalAmount').textContent = '₹0.00';
            return;
        }
        let total = 0;
        tbody.innerHTML = this.cartItems.map((item, i) => {
            const itemTotal = item.price * item.cartQuantity;
            total += itemTotal;
            const colorBadge = item.selectedColor
                ? `<span style="display:inline-flex;align-items:center;gap:0.3rem;background:var(--bg-secondary);border-radius:10px;padding:0.1rem 0.4rem;font-size:0.75rem;margin-left:0.3rem;border:1px solid var(--border);">
                    <span style="width:10px;height:10px;border-radius:50%;background:${this.getColorSwatch(item.selectedColor)};display:inline-block;"></span>${item.selectedColor}</span>`
                : '';
            return `
            <tr>
                <td>${item.name}${colorBadge}</td>
                <td>₹${item.price.toFixed(2)}</td>
                <td>
                    <input type="number" value="${item.cartQuantity}" min="1" max="${item._colorStock !== undefined ? item._colorStock : item.quantity}"
                        style="width:60px;padding:0.25rem 0.5rem;font-size:0.85rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);"
                        onchange="app.updateCartQty(${i}, this.value)">
                </td>
                <td>₹${itemTotal.toFixed(2)}</td>
                <td><button class="btn btn-small btn-danger" onclick="app.removeFromCart(${i})">✕</button></td>
            </tr>`;
        }).join('');
        document.getElementById('totalAmount').textContent = '₹' + total.toFixed(2);
    }

    updateCartQty(index, val) {
        const qty = parseInt(val);
        if (!qty || qty < 1) return;
        const item = this.cartItems[index];
        const limit = item._colorStock !== undefined ? item._colorStock : item.quantity;
        if (qty > limit) {
            this.showNotification(`Not enough stock! (${limit} available)`, 'error');
            this.renderCart();
            return;
        }
        this.cartItems[index].cartQuantity = qty;
        this.renderCart();
    }

    removeFromCart(index) {
        this.cartItems.splice(index, 1);
        this.renderCart();
    }

    clearCart() {
        this.cartItems = [];
        this.renderCart();
    }

    newInvoice() {
        this.clearCart();
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        const typeSelect = document.getElementById('customerType');
        if (typeSelect) typeSelect.value = '';
        this.setDateToToday();
        this.switchBillingTab('customer');
        this.showNotification('Form cleared', 'success');
    }

    generateInvoice() {
        if (this.cartItems.length === 0) {
            this.showNotification('Add items to cart first', 'warning'); return;
        }
        const customerName = document.getElementById('customerName').value || 'Walk-in Customer';
        const customerPhone = document.getElementById('customerPhone').value || '';
        const customerType = document.getElementById('customerType') ? document.getElementById('customerType').value : 'cash';
        const date = document.getElementById('invoiceDate').value || new Date().toISOString().split('T')[0];

        let subtotal = this.cartItems.reduce((s, i) => s + (i.price * i.cartQuantity), 0);
        const taxRate = parseFloat(localStorage.getItem('taxRate')) || 0;
        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;
        const currency = localStorage.getItem('currency') || '₹';
        const prefix = localStorage.getItem('invoicePrefix') || 'INV';

        const invoice = {
            prefix,
            date,
            customerName,
            customerPhone,
            customerType,
            items: this.cartItems.map(i => ({
                id: i.id, name: i.name, price: i.price,
                cartQuantity: i.cartQuantity,
                selectedColor: i.selectedColor || '',
                photo: i.photo || null
            })),
            subtotal,
            taxRate,
            tax,
            total,
            currency
        };

        const saved = storage.addInvoice(invoice);

        // Deduct stock and decrement sold colour qty
        this.cartItems.forEach(item => {
            const p = storage.getProductById(item.id);
            if (p) {
                storage.updateStock(item.id, p.quantity - item.cartQuantity);
                if (item.selectedColor) {
                    storage.removeColorFromProduct(item.id, item.selectedColor, item.cartQuantity);
                }
            }
        });

        this.clearCart();
        this._postInvoiceDashboard = true;
        this.viewInvoice(saved.id);
        this.updateDashboard();
        this.showNotification('Invoice generated!', 'success');
    }

    // =====================
    // INVOICES
    // =====================
    loadInvoices() {
        this.displayInvoices(storage.getInvoices().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }

    displayInvoices(invoices) {
        const container = document.getElementById('invoicesList');
        if (invoices.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No invoices yet.</p>';
            return;
        }
        container.innerHTML = invoices.map(inv => {
            const isPurchase = inv.type === 'purchase';
            const badge = isPurchase
                ? `<span style="font-size:0.7rem;background:rgba(0,201,106,0.15);color:#00c96a;border-radius:10px;padding:0.15rem 0.5rem;margin-left:0.4rem;font-weight:600;">📦 PURCHASE</span>`
                : `<span style="font-size:0.7rem;background:rgba(108,99,255,0.15);color:var(--primary);border-radius:10px;padding:0.15rem 0.5rem;margin-left:0.4rem;font-weight:600;">💳 SALE</span>`;
            const partyName = isPurchase ? (inv.supplierName || 'Supplier') : (inv.customerName || 'Walk-in');
            const amountColor = isPurchase ? 'color:#00c96a;' : 'color:var(--primary);';
            const amountPrefix = isPurchase ? '-' : '+';
            return `
            <div class="invoice-item" style="${isPurchase ? 'border-left:3px solid #00c96a;' : ''}">
                <div class="invoice-info">
                    <div class="invoice-id">${inv.id}${badge}</div>
                    <div class="invoice-customer">${partyName}</div>
                    <div class="invoice-date">${new Date(inv.createdAt).toLocaleString()}</div>
                </div>
                <div class="invoice-amount" style="${amountColor}">${amountPrefix}${inv.currency || '₹'}${(inv.total || 0).toFixed(2)}</div>
                <div class="invoice-actions">
                    <button class="btn btn-small btn-secondary" onclick="${isPurchase ? `app.viewPurchaseInvoice('${inv.id}')` : `app.viewInvoice('${inv.id}')`}">👁️ View</button>
                    <button class="btn btn-small btn-danger" onclick="app.deleteInvoice('${inv.id}')">🗑️</button>
                </div>
            </div>`;
        }).join('');
    }

    searchInvoices(query) {
        const results = query ? storage.searchInvoices(query) : storage.getInvoices().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        this.displayInvoices(results);
    }

    viewInvoice(id) {
        const inv = storage.getInvoiceById(id);
        if (!inv) return;
        const storeName = localStorage.getItem('storeName') || 'Shop Inventory';
        const storePhone = localStorage.getItem('storePhone') || '';
        const storeEmail = localStorage.getItem('storeEmail') || '';
        const storeAddress = localStorage.getItem('storeAddress') || '';
        const currency = inv.currency || '₹';

        const itemsHtml = inv.items.map(item => {
            const colorBadge = item.selectedColor
                ? `<span style="display:inline-block;background:#f0f0ff;border:1px solid #c4b5fd;border-radius:10px;padding:0.1rem 0.4rem;font-size:0.75rem;color:#7c3aed;margin-left:0.3rem;">🎨 ${item.selectedColor}</span>`
                : '';
            return `
            <tr>
                <td style="padding:0.6rem 0.75rem;">${item.name}${colorBadge}</td>
                <td style="text-align:center;padding:0.6rem 0.75rem;">${item.cartQuantity}</td>
                <td style="text-align:right;padding:0.6rem 0.75rem;">${currency}${item.price.toFixed(2)}</td>
                <td style="text-align:right;padding:0.6rem 0.75rem;">${currency}${(item.price * item.cartQuantity).toFixed(2)}</td>
            </tr>`;
        }).join('');

        document.getElementById('invoicePrintContent').innerHTML = `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
                <div style="text-align:center;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid #6c63ff;">
                    <h2 style="color:#6c63ff;font-size:1.5rem;margin-bottom:0.25rem;">🏪 ${storeName}</h2>
                    ${storeAddress ? `<p style="color:#666;font-size:0.85rem;">${storeAddress}</p>` : ''}
                    ${storePhone ? `<p style="color:#666;font-size:0.85rem;">📞 ${storePhone}</p>` : ''}
                    ${storeEmail ? `<p style="color:#666;font-size:0.85rem;">✉️ ${storeEmail}</p>` : ''}
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.5rem;">
                    <div>
                        <p style="font-size:0.8rem;color:#888;margin-bottom:0.25rem;">INVOICE #</p>
                        <p style="font-weight:700;color:#6c63ff;">${inv.id}</p>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-size:0.8rem;color:#888;margin-bottom:0.25rem;">DATE</p>
                        <p style="font-weight:600;">${new Date(inv.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
                <div style="background:#f5f5ff;border-radius:8px;padding:1rem;margin-bottom:1.5rem;">
                    <p style="font-size:0.8rem;color:#888;margin-bottom:0.25rem;">BILLED TO</p>
                    <p style="font-weight:700;">${inv.customerName || 'Walk-in Customer'}</p>
                    ${inv.customerPhone ? `<p style="color:#666;">📞 ${inv.customerPhone}</p>` : ''}
                </div>
                <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">
                    <thead>
                        <tr style="background:#6c63ff;color:white;">
                            <th style="padding:0.75rem;text-align:left;">Product</th>
                            <th style="padding:0.75rem;text-align:center;">Qty</th>
                            <th style="padding:0.75rem;text-align:right;">Price</th>
                            <th style="padding:0.75rem;text-align:right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div style="border-top:2px solid #6c63ff;padding-top:1rem;text-align:right;">
                    <p style="font-size:0.9rem;color:#666;margin-bottom:0.25rem;">Subtotal: ${currency}${(inv.subtotal || inv.total).toFixed(2)}</p>
                    ${inv.tax ? `<p style="font-size:0.9rem;color:#666;margin-bottom:0.25rem;">Tax (${inv.taxRate}%): ${currency}${inv.tax.toFixed(2)}</p>` : ''}
                    <p style="font-size:1.3rem;font-weight:700;color:#6c63ff;">TOTAL: ${currency}${inv.total.toFixed(2)}</p>
                </div>
                <p style="text-align:center;color:#888;font-size:0.8rem;margin-top:2rem;">Thank you for your business! 🙏</p>
            </div>
        `;
        document.getElementById('invoicePrintModal').classList.add('active');
    }

    deleteInvoice(id) {
        if (confirm('Delete this invoice?')) {
            storage.deleteInvoice(id);
            this.loadInvoices();
            this.showNotification('Invoice deleted.', 'success');
        }
    }

    printInvoice() { window.print(); }

    downloadInvoicePDF() {
        const content = document.getElementById('invoicePrintContent').innerHTML;
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Invoice</title><style>body{font-family:sans-serif;padding:2rem;}@media print{body{padding:0;}}</style></head><body>${content}</body></html>`);
        win.document.close();
        win.print();
    }

    // =====================
    // LOW STOCK
    // =====================
    loadLowStockPage() {
        const threshold = this.lowStockThreshold;
        document.getElementById('lowStockThreshold').value = threshold;
        document.getElementById('supplierContact').value = localStorage.getItem('supplierContact') || '';
        document.getElementById('defaultReorderQty').value = localStorage.getItem('defaultReorderQty') || '50';

        const lowStock = storage.getLowStockProducts(threshold);
        const critical = lowStock.filter(p => p.quantity <= 3);
        const warning = lowStock.filter(p => p.quantity > 3);

        document.getElementById('totalLowStockCount').textContent = lowStock.length;
        document.getElementById('criticalCount').textContent = critical.length;
        document.getElementById('warningCount').textContent = warning.length;

        const tbody = document.getElementById('lowstockList');
        if (lowStock.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:1.5rem;">✅ All products are well stocked!</td></tr>';
            return;
        }
        const defaultQty = parseInt(localStorage.getItem('defaultReorderQty')) || 50;
        tbody.innerHTML = lowStock.map(p => {
            const isCritical = p.quantity <= 3;
            const savedReorderQty = parseInt(localStorage.getItem('reorderQty_' + p.id)) || defaultQty;
            return `
            <tr>
                <td>${p.name}</td>
                <td style="color:${isCritical ? 'var(--pink)' : 'orange'};font-weight:700;">${p.quantity}</td>
                <td>${threshold}</td>
                <td><span class="product-stock ${isCritical ? 'stock-low' : ''}" style="${!isCritical ? 'background:rgba(251,146,60,0.15);color:orange;' : ''}">${isCritical ? '🔴 Critical' : '🟡 Warning'}</span></td>
                <td>
                    <input type="number" id="reorderQty_${p.id}" value="${savedReorderQty}" min="1"
                        style="width:70px;padding:0.25rem 0.4rem;font-size:0.85rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);"
                        onchange="localStorage.setItem('reorderQty_${p.id}', this.value)">
                </td>
                <td style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                    <button class="btn btn-small btn-primary" onclick="app.reorderProduct('${p.id}')">📦 Reorder</button>
                    <button class="btn btn-small btn-secondary" onclick="app.openProductModal('${p.id}')">✏️ Edit</button>
                </td>
            </tr>`;
        }).join('');
    }

    saveReorderSettings() {
        const contact = document.getElementById('supplierContact').value.trim();
        const qty = parseInt(document.getElementById('defaultReorderQty').value) || 50;
        localStorage.setItem('supplierContact', contact);
        localStorage.setItem('defaultReorderQty', qty);
        this.showNotification('✅ Reorder settings saved!', 'success');
    }

    reorderProduct(productId) {
        const p = storage.getProductById(productId);
        if (!p) return;
        // If product has colours, show colour-qty picker first
        if (p.colors && p.colors.length > 0) {
            this._showReorderColorPicker([p]);
            return;
        }
        const qtyInput = document.getElementById('reorderQty_' + productId);
        const qty = qtyInput ? parseInt(qtyInput.value) || 50 : 50;
        const supplier = localStorage.getItem('supplierContact') || '';
        this.showReorderModal([{ product: p, qty }], supplier);
    }

    reorderAll() {
        const threshold = this.lowStockThreshold;
        const lowStock = storage.getLowStockProducts(threshold);
        if (lowStock.length === 0) {
            this.showNotification('No low stock items to reorder', 'warning');
            return;
        }
        // If any product has colours, show colour picker step
        const hasAnyColors = lowStock.some(p => p.colors && p.colors.length > 0);
        if (hasAnyColors) {
            this._showReorderColorPicker(lowStock);
            return;
        }
        const defaultQty = parseInt(localStorage.getItem('defaultReorderQty')) || 50;
        const items = lowStock.map(p => {
            const qty = parseInt(localStorage.getItem('reorderQty_' + p.id)) || defaultQty;
            return { product: p, qty };
        });
        const supplier = localStorage.getItem('supplierContact') || '';
        this.showReorderModal(items, supplier);
    }

    _showReorderColorPicker(products) {
        const existing = document.getElementById('reorderColorPickerModal');
        if (existing) existing.remove();
        const defaultQty = parseInt(localStorage.getItem('defaultReorderQty')) || 50;

        // Store product list for confirm step
        this._pendingReorderProducts = products;

        const productsHtml = products.map((p, pi) => {
            // Always fetch fresh from storage to get ALL colours, including zero-stock ones
            const fp = storage.getProductById(p.id) || p;
            const allColors = (fp.colors && fp.colors.length > 0) ? fp.colors : [];
            const hasColors = allColors.length > 0;

            const colorRows = hasColors ? allColors.map((c, ci) => {
                const name = typeof c === 'string' ? c : c.name;
                const currentStock = typeof c === 'string' ? 0 : (c.qty || 0);
                const swatch = this.getColorSwatch(name);
                const isZero = currentStock === 0;
                return `
                <div style="display:flex;align-items:center;gap:0.6rem;background:var(--bg-primary);border-radius:8px;padding:0.45rem 0.65rem;border:1px solid ${isZero ? 'rgba(239,68,68,0.4)' : 'var(--border)'};margin-bottom:0.4rem;">
                    <span style="width:13px;height:13px;border-radius:50%;background:${swatch};flex-shrink:0;border:1.5px solid rgba(255,255,255,0.25);"></span>
                    <span style="flex:1;font-size:0.86rem;color:var(--text-light);">${name}</span>
                    <span style="font-size:0.75rem;${isZero ? 'color:var(--pink);font-weight:700;' : 'color:var(--text-muted);'}">Stock: ${currentStock}${isZero ? ' ⚠️' : ''}</span>
                    <input type="number" min="0" value="${defaultQty}"
                        data-product-idx="${pi}" data-color-name="${name}"
                        id="rcp_${pi}_${ci}"
                        style="width:72px;padding:0.3rem 0.4rem;font-size:0.84rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);text-align:center;"
                        oninput="app._updateReorderColorTotal(${pi})">
                </div>`;
            }).join('') : `
                <div style="display:flex;align-items:center;gap:0.6rem;background:var(--bg-primary);border-radius:8px;padding:0.45rem 0.65rem;border:1px solid var(--border);">
                    <span style="font-size:0.85rem;color:var(--text-muted);">Quantity to order:</span>
                    <input type="number" min="0" value="${defaultQty}"
                        data-product-idx="${pi}" data-color-name=""
                        id="rcp_${pi}_0"
                        style="width:80px;padding:0.3rem 0.4rem;font-size:0.84rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-light);text-align:center;"
                        oninput="app._updateReorderColorTotal(${pi})">
                </div>`;

            const initTotal = hasColors ? allColors.length * defaultQty : defaultQty;
            return `
            <div style="background:var(--bg-secondary);border-radius:12px;padding:1rem;margin-bottom:1rem;border:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;">
                    ${fp.photo
                        ? `<img src="${fp.photo}" style="width:42px;height:42px;object-fit:cover;border-radius:8px;flex-shrink:0;">`
                        : `<div style="width:42px;height:42px;background:var(--bg-primary);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">📦</div>`
                    }
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;color:var(--cyan);font-size:0.92rem;">${fp.name}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);">Current stock: ${fp.quantity} units${hasColors ? ` · ${allColors.length} colour${allColors.length>1?'s':''}` : ''}</div>
                    </div>
                    <div style="text-align:right;font-size:0.8rem;color:var(--text-muted);">
                        Total:<br><strong id="rcp_total_${pi}" style="color:var(--primary);font-size:1rem;">${initTotal}</strong>
                    </div>
                </div>
                <div>
                    ${hasColors ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.5rem;font-weight:600;">🎨 QTY TO REORDER PER COLOUR <span style="font-weight:400;">(⚠️ = sold out)</span></div>` : ''}
                    ${colorRows}
                </div>
            </div>`;
        }).join('');

        const modal = document.createElement('div');
        modal.id = 'reorderColorPickerModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:520px;max-height:90vh;overflow-y:auto;">
                <span class="close" onclick="document.getElementById('reorderColorPickerModal').remove()">×</span>
                <div style="text-align:center;margin-bottom:1.25rem;">
                    <div style="font-size:2rem;margin-bottom:0.4rem;">🎨 📦</div>
                    <h2 style="color:var(--cyan);">Reorder — Pick Colours & Qty</h2>
                    <p style="color:var(--text-muted);font-size:0.85rem;">All saved colours shown — including sold-out ones (⚠️). Set qty to 0 to skip any colour.</p>
                </div>
                ${productsHtml}
                <div style="display:flex;gap:0.75rem;margin-top:0.5rem;">
                    <button class="btn btn-secondary" style="flex:1;" onclick="document.getElementById('reorderColorPickerModal').remove()">Cancel</button>
                    <button class="btn btn-primary" style="flex:2;" onclick="app._confirmReorderColorPicker()">
                        📦 Continue to Reorder →
                    </button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

        // Initialize totals
        products.forEach((_, pi) => this._updateReorderColorTotal(pi));
    }

    _updateReorderColorTotal(productIdx) {
        const inputs = document.querySelectorAll(`#reorderColorPickerModal input[data-product-idx="${productIdx}"]`);
        let total = 0;
        inputs.forEach(inp => { total += parseInt(inp.value) || 0; });
        const el = document.getElementById('rcp_total_' + productIdx);
        if (el) el.textContent = total;
    }

    _confirmReorderColorPicker() {
        const modal = document.getElementById('reorderColorPickerModal');
        if (!modal) return;
        const products = this._pendingReorderProducts || [];

        // Collect all inputs grouped by product index
        const byIdx = {};
        modal.querySelectorAll('input[data-product-idx]').forEach(inp => {
            const pi = String(inp.dataset.productIdx);
            const qty = parseInt(inp.value) || 0;
            if (qty === 0) return;
            if (!byIdx[pi]) byIdx[pi] = [];
            byIdx[pi].push({ colorName: inp.dataset.colorName, qty });
        });

        modal.remove();
        this._pendingReorderProducts = null;

        const reorderItems = [];
        products.forEach((p, pi) => {
            const entries = byIdx[String(pi)] || [];
            entries.forEach(({ colorName, qty }) => {
                reorderItems.push({
                    product: { ...p, _reorderColor: colorName || null },
                    qty,
                    colorName: colorName || null
                });
            });
        });

        if (reorderItems.length === 0) {
            this.showNotification('Enter at least one quantity > 0', 'warning');
            return;
        }

        const supplier = localStorage.getItem('supplierContact') || '';
        this.showReorderModal(reorderItems, supplier);
    }

    showReorderModal(items, supplier) {
        const existing = document.getElementById('reorderModal');
        if (existing) existing.remove();
        const storeName = localStorage.getItem('storeName') || 'Shop Inventory';
        const currency = localStorage.getItem('currency') || '₹';
        const itemsText = items.map(i => {
            const colorLabel = i.colorName ? ` [${i.colorName}]` : (i.product._reorderColor ? ` [${i.product._reorderColor}]` : '');
            return `• ${i.product.name}${colorLabel} — Qty: ${i.qty}`;
        }).join('\n');

        const itemsHtml = items.map(i => {
            const wholesalePrice = i.product.wholesalePrice || i.product.price;
            const lineTotal = wholesalePrice * i.qty;
            const colorLabel = i.colorName || i.product._reorderColor || null;
            const swatch = colorLabel ? `<span style="width:11px;height:11px;border-radius:50%;background:${this.getColorSwatch(colorLabel)};display:inline-block;border:1px solid rgba(0,0,0,0.2);margin-right:4px;vertical-align:middle;"></span>` : '';
            return `
            <tr>
                <td style="padding:0.5rem 0.75rem;">
                    <div style="display:flex;align-items:center;gap:0.6rem;">
                        ${i.product.photo
                            ? `<img src="${i.product.photo}" alt="${i.product.name}" style="width:38px;height:38px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">`
                            : `<div style="width:38px;height:38px;background:var(--bg-primary);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;border:1px solid var(--border);">📦</div>`
                        }
                        <div>
                            <span style="font-weight:600;">${i.product.name}</span>
                            ${colorLabel ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.1rem;">${swatch}${colorLabel}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td style="padding:0.5rem 0.75rem;color:var(--pink);font-weight:700;">${i.product.quantity}</td>
                <td style="padding:0.5rem 0.75rem;color:var(--cyan);font-weight:700;">${i.qty}</td>
                <td style="padding:0.5rem 0.75rem;color:var(--text-muted);font-size:0.85rem;">${currency}${wholesalePrice.toFixed(2)}</td>
                <td style="padding:0.5rem 0.75rem;color:var(--primary);font-weight:700;">${currency}${lineTotal.toFixed(2)}</td>
            </tr>`;
        }).join('');

        const grandTotal = items.reduce((s, i) => s + ((i.product.wholesalePrice || i.product.price) * i.qty), 0);
        const itemsJson = JSON.stringify(items.map(i => ({
            id: i.product.id,
            qty: i.qty,
            colorName: i.colorName || i.product._reorderColor || null
        })));

        const savedEmails = JSON.parse(localStorage.getItem('supplierEmails') || '[]');
        const emailsHtml = savedEmails.map((em, idx) => `
            <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.4rem;">
                <span style="font-size:0.85rem;color:var(--text-light);flex:1;background:var(--bg-primary);border-radius:6px;padding:0.35rem 0.6rem;">${em}</span>
                <button onclick="app.removeSupplierEmail(${idx})" style="background:rgba(239,68,68,0.15);border:none;color:var(--pink);border-radius:6px;padding:0.3rem 0.5rem;cursor:pointer;">✕</button>
            </div>`).join('');

        const modal = document.createElement('div');
        modal.id = 'reorderModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content reorder-modal" style="max-width:600px;">
                <span class="close" onclick="document.getElementById('reorderModal').remove()">×</span>
                <div style="text-align:center;margin-bottom:1rem;">
                    <div style="font-size:2.5rem;margin-bottom:0.5rem;">📦</div>
                    <h2 style="color:var(--cyan);">Reorder Request</h2>
                    <p style="color:var(--text-muted);font-size:0.9rem;">${items.length} item${items.length > 1 ? 's' : ''} — Purchase Total: <strong style="color:var(--primary);">${currency}${grandTotal.toFixed(2)}</strong></p>
                </div>

                <div style="overflow-x:auto;margin-bottom:1.25rem;">
                <table style="width:100%;border-collapse:collapse;font-size:0.88rem;background:var(--bg-secondary);border-radius:8px;overflow:hidden;">
                    <thead>
                        <tr style="background:var(--primary);color:white;">
                            <th style="padding:0.6rem 0.75rem;text-align:left;">Product</th>
                            <th style="padding:0.6rem 0.75rem;text-align:left;">Stock</th>
                            <th style="padding:0.6rem 0.75rem;text-align:left;">Order</th>
                            <th style="padding:0.6rem 0.75rem;text-align:left;">Unit Cost</th>
                            <th style="padding:0.6rem 0.75rem;text-align:left;">Total</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                    <tfoot>
                        <tr style="background:rgba(108,99,255,0.15);">
                            <td colspan="4" style="padding:0.6rem 0.75rem;font-weight:700;text-align:right;">Grand Total:</td>
                            <td style="padding:0.6rem 0.75rem;font-weight:700;color:var(--primary);">${currency}${grandTotal.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                </div>

                <div class="form-group">
                    <label style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">📧 Supplier Emails</label>
                    <div style="display:flex;gap:0.4rem;margin-top:0.4rem;">
                        <input type="email" id="reorderSupplierInput" placeholder="Add supplier email..." value="${supplier && supplier.includes('@') ? supplier : ''}"
                            style="flex:1;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text-light);font-size:0.88rem;">
                        <button onclick="app.addSupplierEmail()" style="background:var(--primary);border:none;color:white;border-radius:8px;padding:0.55rem 0.85rem;cursor:pointer;font-size:0.88rem;white-space:nowrap;">+ Add</button>
                    </div>
                    <div id="supplierEmailsList">${emailsHtml}</div>
                </div>

                <div class="form-group" style="margin-top:0.75rem;">
                    <label style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">💬 WhatsApp Number</label>
                    <input type="tel" id="reorderWhatsAppInput" value="${supplier && !supplier.includes('@') ? supplier : localStorage.getItem('supplierContact') || ''}" placeholder="+91 9999999999"
                        style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text-light);width:100%;font-size:0.88rem;margin-top:0.4rem;">
                </div>

                <div class="form-group" style="margin-top:0.75rem;">
                    <label style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">✉️ Message</label>
                    <textarea id="reorderNote" rows="5"
                        style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:0.75rem;color:var(--text-light);width:100%;font-size:0.85rem;resize:vertical;margin-top:0.4rem;"
                    >Dear Supplier,\n\nWe need to reorder the following items for ${storeName}:\n\n${itemsText}\n\nTotal Purchase Amount: ${currency}${grandTotal.toFixed(2)}\n\nPlease confirm availability and estimated delivery.\n\nThank you.</textarea>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-top:0.75rem;">
                    <button class="btn btn-primary btn-small" onclick="app.sendReorderViaEmail()">📧 Email All</button>
                    <button class="btn btn-secondary btn-small" onclick="app.sendReorderViaWhatsApp()">💬 WhatsApp</button>
                    <button class="btn btn-secondary btn-small" onclick="app.copyReorderNote()">📋 Copy</button>
                </div>
                <button class="btn btn-primary" style="width:100%;margin-top:0.75rem;background:linear-gradient(135deg,#00c96a,#00a855);"
                    onclick='app.confirmReorderReceived(${itemsJson})'>✅ Mark as Ordered & Generate Purchase Invoice</button>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    addSupplierEmail() {
        const input = document.getElementById('reorderSupplierInput');
        const email = input.value.trim();
        if (!email || !email.includes('@')) { this.showNotification('Enter a valid email', 'warning'); return; }
        const emails = JSON.parse(localStorage.getItem('supplierEmails') || '[]');
        if (emails.includes(email)) { this.showNotification('Email already added', 'warning'); return; }
        emails.push(email);
        localStorage.setItem('supplierEmails', JSON.stringify(emails));
        input.value = '';
        const list = document.getElementById('supplierEmailsList');
        if (list) {
            list.innerHTML = emails.map((em, idx) => `
                <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.4rem;">
                    <span style="font-size:0.85rem;color:var(--text-light);flex:1;background:var(--bg-primary);border-radius:6px;padding:0.35rem 0.6rem;">${em}</span>
                    <button onclick="app.removeSupplierEmail(${idx})" style="background:rgba(239,68,68,0.15);border:none;color:var(--pink);border-radius:6px;padding:0.3rem 0.5rem;cursor:pointer;">✕</button>
                </div>`).join('');
        }
        this.showNotification(`✅ ${email} added!`, 'success');
    }

    removeSupplierEmail(idx) {
        const emails = JSON.parse(localStorage.getItem('supplierEmails') || '[]');
        emails.splice(idx, 1);
        localStorage.setItem('supplierEmails', JSON.stringify(emails));
        const list = document.getElementById('supplierEmailsList');
        if (list) {
            list.innerHTML = emails.map((em, i) => `
                <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.4rem;">
                    <span style="font-size:0.85rem;color:var(--text-light);flex:1;background:var(--bg-primary);border-radius:6px;padding:0.35rem 0.6rem;">${em}</span>
                    <button onclick="app.removeSupplierEmail(${i})" style="background:rgba(239,68,68,0.15);border:none;color:var(--pink);border-radius:6px;padding:0.3rem 0.5rem;cursor:pointer;">✕</button>
                </div>`).join('');
        }
        this.showNotification('Email removed', 'success');
    }

    sendReorderViaEmail() {
        const note = document.getElementById('reorderNote').value;
        const storeName = localStorage.getItem('storeName') || 'Shop Inventory';
        const typed = document.getElementById('reorderSupplierInput').value.trim();
        const savedEmails = JSON.parse(localStorage.getItem('supplierEmails') || '[]');
        const allEmails = [...new Set([...savedEmails, ...(typed && typed.includes('@') ? [typed] : [])])];
        if (allEmails.length === 0) { this.showNotification('Add at least one supplier email first', 'warning'); return; }
        const mailto = allEmails.join(',');

        // Save sent info for feedback panel
        const sentInfo = {
            type: 'email',
            recipients: allEmails,
            sentAt: new Date().toISOString(),
            subject: 'Reorder Request from ' + storeName
        };
        sessionStorage.setItem('whatsapp_sent', JSON.stringify(sentInfo));

        window.open(`mailto:${mailto}?subject=${encodeURIComponent('Reorder Request from ' + storeName)}&body=${encodeURIComponent(note)}`);

        // Show inline success immediately (email doesn't leave page)
        document.getElementById('reorderModal')?.remove();
        this.showSentSuccessPanel(sentInfo);
    }

    sendReorderViaWhatsApp() {
        const phoneInput = document.getElementById('reorderWhatsAppInput').value.trim();
        const note = document.getElementById('reorderNote').value;
        const phone = phoneInput.replace(/\D/g, '');
        const storeName = localStorage.getItem('storeName') || 'Shop Inventory';

        if (!phone) {
            this.showNotification('Enter a WhatsApp number first', 'warning');
            return;
        }

        // Collect product info for display
        const rows = document.querySelectorAll('#reorderModal tbody tr');
        const productList = [];
        rows.forEach(row => {
            const img = row.querySelector('img');
            const nameEl = row.querySelector('span[style*="font-weight"]') || row.querySelector('td:first-child span');
            const name = nameEl ? nameEl.textContent.trim() : '';
            productList.push({ name, imgSrc: img ? img.src : null });
        });

        const sentInfo = {
            type: 'whatsapp',
            phone: '+' + phone,
            recipients: ['+' + phone],
            sentAt: new Date().toISOString(),
            storeName,
            products: productList
        };
        sessionStorage.setItem('whatsapp_sent', JSON.stringify(sentInfo));

        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(note)}`;

        // Remove reorder modal first
        document.getElementById('reorderModal')?.remove();

        // Open WhatsApp in new tab
        window.open(waUrl, '_blank');

        // Listen for user returning to this tab — show success panel immediately
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                document.removeEventListener('visibilitychange', onVisible);
                const pending = sessionStorage.getItem('whatsapp_sent');
                if (pending) {
                    sessionStorage.removeItem('whatsapp_sent');
                    this.showSentSuccessPanel(JSON.parse(pending));
                }
            }
        };
        document.addEventListener('visibilitychange', onVisible);

        // Also show a small toast so user knows what to do
        this.showNotification('💬 WhatsApp opened — return here after sending!', 'success');
    }

    showSentSuccessPanel(info) {
        // Remove existing
        document.getElementById('sentSuccessPanel')?.remove();

        const panel = document.createElement('div');
        panel.id = 'sentSuccessPanel';
        panel.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99998;display:flex;align-items:center;justify-content:center;padding:1rem;';

        const typeIcon = info.type === 'whatsapp' ? '💬' : '📧';
        const typeName = info.type === 'whatsapp' ? 'WhatsApp' : 'Email';
        const recipientsList = (info.recipients || []).map(r =>
            `<div style="background:rgba(0,201,106,0.1);border:1px solid rgba(0,201,106,0.3);border-radius:8px;padding:0.4rem 0.75rem;font-size:0.85rem;color:#00c96a;margin-bottom:0.3rem;">${r}</div>`
        ).join('');
        const sentTime = info.sentAt ? new Date(info.sentAt).toLocaleString() : new Date().toLocaleString();

        const productsSection = (info.products && info.products.length > 0) ? `
            <div style="margin:1rem 0;">
                <p style="color:#888;font-size:0.8rem;margin-bottom:0.5rem;font-weight:600;">PRODUCTS IN REQUEST</p>
                <div style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center;">
                    ${info.products.map(p => `<div style="text-align:center;">
                        ${p.imgSrc ? `<img src="${p.imgSrc}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:2px solid #00c96a;">` : `<div style="width:48px;height:48px;background:#f0fdf4;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;border:2px solid #00c96a;">📦</div>`}
                        <div style="font-size:0.7rem;color:#555;margin-top:0.2rem;max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div>
                    </div>`).join('')}
                </div>
            </div>` : '';

        panel.innerHTML = `
            <div style="background:white;border-radius:20px;padding:2rem;max-width:400px;width:100%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,0.5);">
                <div style="width:64px;height:64px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 1rem;">✅</div>
                <h2 style="color:#166534;margin-bottom:0.25rem;">Message Sent!</h2>
                <p style="color:#555;font-size:0.9rem;margin-bottom:1.25rem;">Your reorder request was sent via ${typeIcon} ${typeName}</p>

                <div style="background:#f8fafc;border-radius:12px;padding:1rem;margin-bottom:1rem;text-align:left;">
                    <p style="color:#888;font-size:0.75rem;font-weight:700;text-transform:uppercase;margin-bottom:0.5rem;">Sent To</p>
                    ${recipientsList}
                    <p style="color:#aaa;font-size:0.75rem;margin-top:0.5rem;">🕐 ${sentTime}</p>
                </div>

                ${productsSection}

                <p style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:0.6rem;font-size:0.8rem;color:#92400e;margin-bottom:1.25rem;">
                    💡 Mark the reorder as received once the stock arrives to update your inventory
                </p>

                <button onclick="document.getElementById('sentSuccessPanel').remove()" style="width:100%;padding:0.85rem;background:linear-gradient(135deg,#6c63ff,#5a52e8);border:none;color:white;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;">
                    Back to App →
                </button>
            </div>`;
        document.body.appendChild(panel);
        panel.addEventListener('click', (e) => { if (e.target === panel) panel.remove(); });
    }

    copyReorderNote() {
        navigator.clipboard.writeText(document.getElementById('reorderNote').value)
            .then(() => this.showNotification('📋 Copied to clipboard!', 'success'))
            .catch(() => this.showNotification('Copy failed — select manually', 'error'));
    }

    confirmReorderReceived(items) {
        if (!confirm(`Generate a purchase invoice and add reorder quantities to stock for ${items.length} item(s)?`)) return;

        const currency = localStorage.getItem('currency') || '₹';
        const storeName = localStorage.getItem('storeName') || 'Shop Inventory';
        const supplierEmails = JSON.parse(localStorage.getItem('supplierEmails') || '[]');
        const supplierContact = document.getElementById('reorderWhatsAppInput')?.value || localStorage.getItem('supplierContact') || '';

        const invoiceItems = [];
        let purchaseTotal = 0;

        items.forEach(({ id, qty, colorName }) => {
            const p = storage.getProductById(id);
            if (p) {
                const unitCost = p.wholesalePrice || p.price;
                const lineTotal = unitCost * qty;
                const colorLabel = colorName || null;
                invoiceItems.push({
                    id: p.id,
                    name: p.name + (colorLabel ? ` — ${colorLabel}` : ''),
                    price: unitCost,
                    cartQuantity: qty,
                    selectedColor: colorLabel || '',
                    photo: p.photo || null
                });
                purchaseTotal += lineTotal;

                // Update overall stock quantity
                storage.updateStock(id, p.quantity + qty);

                // Update per-colour qty if this reorder is for a specific colour
                if (colorLabel && p.colors && p.colors.length > 0) {
                    const updatedColors = p.colors.map(c => {
                        const cName = typeof c === 'string' ? c : c.name;
                        if (cName.toLowerCase() === colorLabel.toLowerCase()) {
                            const existingQty = typeof c === 'string' ? 0 : (c.qty || 0);
                            return { name: cName, qty: existingQty + qty };
                        }
                        return typeof c === 'string' ? { name: c, qty: 0 } : c;
                    });
                    // Re-fetch to get the latest (updateStock may have changed the record)
                    const refreshed = storage.getProductById(id);
                    if (refreshed) storage.updateProduct(id, { colors: updatedColors });
                }
            }
        });

        const purchaseInvoice = {
            type: 'purchase',
            supplierName: supplierEmails.length > 0 ? supplierEmails[0] : (supplierContact || 'Supplier'),
            supplierContact: supplierContact,
            supplierEmails,
            items: invoiceItems,
            subtotal: purchaseTotal,
            taxRate: 0,
            tax: 0,
            total: purchaseTotal,
            currency,
            note: 'Purchase / Reorder — stock added'
        };

        const saved = storage.addInvoice(purchaseInvoice);

        document.getElementById('reorderModal')?.remove();
        this.loadLowStockPage();
        this.updateDashboard();
        this.showNotification(`✅ Stock updated! Purchase invoice ${saved.id} generated.`, 'success');
        setTimeout(() => this.viewPurchaseInvoice(saved.id), 400);
    }

    viewPurchaseInvoice(id) {
        const inv = storage.getInvoiceById(id);
        if (!inv) return;
        const storeName = localStorage.getItem('storeName') || 'Shop Inventory';
        const storePhone = localStorage.getItem('storePhone') || '';
        const storeAddress = localStorage.getItem('storeAddress') || '';
        const currency = inv.currency || '₹';

        const itemsHtml = inv.items.map(item => `
            <tr>
                <td style="padding:0.6rem 0.75rem;display:flex;align-items:center;gap:0.6rem;">
                    ${item.photo ? `<img src="${item.photo}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">` : '<span style="font-size:1.2rem;">📦</span>'}
                    <span>${item.name}</span>
                </td>
                <td style="padding:0.6rem 0.75rem;text-align:center;">${item.cartQuantity}</td>
                <td style="padding:0.6rem 0.75rem;text-align:right;">${currency}${item.price.toFixed(2)}</td>
                <td style="padding:0.6rem 0.75rem;text-align:right;">${currency}${(item.price * item.cartQuantity).toFixed(2)}</td>
            </tr>
        `).join('');

        document.getElementById('invoicePrintContent').innerHTML = `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
                <div style="text-align:center;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid #00c96a;">
                    <h2 style="color:#00a855;font-size:1.4rem;margin-bottom:0.25rem;">🏪 ${storeName}</h2>
                    ${storeAddress ? `<p style="color:#666;font-size:0.85rem;">${storeAddress}</p>` : ''}
                    ${storePhone ? `<p style="color:#666;font-size:0.85rem;">📞 ${storePhone}</p>` : ''}
                    <div style="display:inline-block;background:#dcfce7;border:1px solid #86efac;border-radius:20px;padding:0.25rem 0.9rem;margin-top:0.5rem;">
                        <span style="color:#166534;font-size:0.8rem;font-weight:700;">📦 PURCHASE INVOICE</span>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.5rem;">
                    <div>
                        <p style="font-size:0.8rem;color:#888;margin-bottom:0.25rem;">INVOICE #</p>
                        <p style="font-weight:700;color:#00a855;">${inv.id}</p>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-size:0.8rem;color:#888;margin-bottom:0.25rem;">DATE</p>
                        <p style="font-weight:600;">${new Date(inv.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
                <div style="background:#f0fdf4;border-radius:8px;padding:1rem;margin-bottom:1.5rem;border:1px solid #86efac;">
                    <p style="font-size:0.8rem;color:#888;margin-bottom:0.25rem;">SUPPLIER</p>
                    <p style="font-weight:700;">${inv.supplierName || 'Supplier'}</p>
                    ${inv.supplierContact ? `<p style="color:#555;font-size:0.85rem;">📞 ${inv.supplierContact}</p>` : ''}
                    ${inv.supplierEmails && inv.supplierEmails.length > 0 ? `<p style="color:#555;font-size:0.85rem;">✉️ ${inv.supplierEmails.join(', ')}</p>` : ''}
                </div>
                <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">
                    <thead>
                        <tr style="background:#00a855;color:white;">
                            <th style="padding:0.75rem;text-align:left;">Product</th>
                            <th style="padding:0.75rem;text-align:center;">Qty</th>
                            <th style="padding:0.75rem;text-align:right;">Unit Cost</th>
                            <th style="padding:0.75rem;text-align:right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div style="border-top:2px solid #00c96a;padding-top:1rem;text-align:right;">
                    <p style="font-size:1.3rem;font-weight:700;color:#00a855;">PURCHASE TOTAL: ${currency}${inv.total.toFixed(2)}</p>
                    <p style="font-size:0.8rem;color:#888;margin-top:0.25rem;">This amount is deducted from net revenue</p>
                </div>
                <p style="text-align:center;color:#888;font-size:0.8rem;margin-top:2rem;">📦 Stock has been updated · ${new Date(inv.createdAt).toLocaleString()}</p>
            </div>
        `;
        document.getElementById('invoicePrintModal').classList.add('active');
    }

    saveThreshold() {
        const val = parseInt(document.getElementById('lowStockThreshold').value);
        if (!val || val < 1) { this.showNotification('Threshold must be ≥ 1', 'warning'); return; }
        this.lowStockThreshold = val;
        localStorage.setItem('lowStockThreshold', val);
        this.loadLowStockPage();
        this.showNotification(`Threshold set to ${val} units`, 'success');
    }

    // =====================
    // SETTINGS
    // =====================
    loadSettings() {
        document.getElementById('storeName').value = localStorage.getItem('storeName') || '';
        document.getElementById('storeOwner').value = localStorage.getItem('storeOwner') || '';
        document.getElementById('storeEmail').value = localStorage.getItem('storeEmail') || '';
        document.getElementById('storePhone').value = localStorage.getItem('storePhone') || '';
        document.getElementById('storeAddress').value = localStorage.getItem('storeAddress') || '';
        document.getElementById('currency').value = localStorage.getItem('currency') || '₹';
        document.getElementById('taxRate').value = localStorage.getItem('taxRate') || '0';
        document.getElementById('invoicePrefix').value = localStorage.getItem('invoicePrefix') || 'INV';
        document.getElementById('lowStockThresholdSetting').value = this.lowStockThreshold;
        const theme = localStorage.getItem('shopTheme') || 'dark';
        document.querySelectorAll('input[name="appTheme"]').forEach(r => {
            r.checked = r.value === theme;
        });
        this.loadProfilesInSettings();
    }

    loadProfilesInSettings() {
        const container = document.getElementById('profilesSettingsList');
        if (!container) return;
        const profiles = storage.getAllProfiles();
        const active = storage.getCurrentUser();
        container.innerHTML = profiles.map(p => `
            <div style="display:flex;align-items:center;gap:0.75rem;background:var(--bg-secondary);border-radius:10px;padding:0.65rem 0.85rem;margin-bottom:0.5rem;border:${p.id === active ? '1.5px solid var(--primary)' : '1px solid var(--border)'};">
                <span style="font-size:1.5rem;">${p.avatar || '👤'}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;color:var(--text-light);">${p.name}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted);">${p.email}</div>
                </div>
                ${p.id === active ? `<span style="font-size:0.72rem;background:rgba(108,99,255,0.2);color:var(--primary);border-radius:10px;padding:0.15rem 0.5rem;font-weight:600;">Active</span>` : ''}
                ${profiles.length > 1 && p.id !== active ? `<button onclick="app.deleteProfileFromSettings('${p.id}')" style="background:rgba(239,68,68,0.15);border:none;color:var(--pink);border-radius:6px;padding:0.3rem 0.5rem;cursor:pointer;font-size:0.8rem;">🗑️</button>` : ''}
            </div>
        `).join('');
    }

    deleteProfileFromSettings(id) {
        if (!confirm('Delete this profile and all their data?')) return;
        storage.deleteProfile(id);
        this.loadProfilesInSettings();
        this.showNotification('Profile deleted', 'success');
    }

    openAddProfileModal() {
        const avatarOptions = ['👤', '👩', '👨', '🧑', '👩‍💼', '👨‍💼', '🧑‍💼', '👩‍🔬', '👨‍🔬'];
        const modal = document.createElement('div');
        modal.id = 'addProfileModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:420px;">
                <span class="close" onclick="document.getElementById('addProfileModal').remove()">×</span>
                <h2 style="margin-bottom:1.25rem;color:var(--cyan);">👤 Add New Profile</h2>
                <div class="form-group">
                    <label>Avatar</label>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.4rem;" id="avatarPicker">
                        ${avatarOptions.map((a, i) => `<button type="button" onclick="app.selectAvatar('${a}',this)" style="font-size:1.5rem;padding:0.35rem 0.55rem;background:${i===0?'var(--primary)':'var(--bg-secondary)'};border:${i===0?'2px solid var(--primary)':'1px solid var(--border)'};border-radius:8px;cursor:pointer;">${a}</button>`).join('')}
                    </div>
                    <input type="hidden" id="newProfileAvatarVal" value="👤">
                </div>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="newProfileNameModal" placeholder="Your name">
                </div>
                <div class="form-group">
                    <label>Email *</label>
                    <input type="email" id="newProfileEmailModal" placeholder="your@email.com">
                </div>
                <button class="btn btn-primary" style="width:100%;margin-top:0.75rem;" onclick="app.saveNewProfileFromModal()">➕ Add Profile</button>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    selectAvatar(avatar, btn) {
        document.getElementById('newProfileAvatarVal').value = avatar;
        document.querySelectorAll('#avatarPicker button').forEach(b => {
            b.style.background = 'var(--bg-secondary)';
            b.style.border = '1px solid var(--border)';
        });
        btn.style.background = 'var(--primary)';
        btn.style.border = '2px solid var(--primary)';
    }

    saveNewProfileFromModal() {
        const email = document.getElementById('newProfileEmailModal').value.trim();
        const name = document.getElementById('newProfileNameModal').value.trim() || email.split('@')[0];
        const avatar = document.getElementById('newProfileAvatarVal').value || '👤';
        if (!email || !email.includes('@')) { this.showNotification('Enter a valid email', 'warning'); return; }

        const profileId = 'profile_' + Date.now();
        const profile = { id: profileId, name, email, avatar, createdAt: new Date().toISOString() };
        storage.addProfile(profile);
        document.getElementById('addProfileModal')?.remove();
        this.loadProfilesInSettings();
        this.showNotification(`✅ Profile "${name}" added!`, 'success');
    }

    saveStoreInfo() {
        const storeName = document.getElementById('storeName').value.trim();
        if (!storeName) { this.showNotification('Store name is required', 'warning'); return; }
        localStorage.setItem('storeName', storeName);
        localStorage.setItem('storeOwner', document.getElementById('storeOwner').value);
        localStorage.setItem('storeEmail', document.getElementById('storeEmail').value);
        localStorage.setItem('storePhone', document.getElementById('storePhone').value);
        localStorage.setItem('storeAddress', document.getElementById('storeAddress').value);
        this.showNotification('✅ Store info saved!', 'success');
    }

    saveGeneralSettings() {
        const currency = document.getElementById('currency').value;
        const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
        const invoicePrefix = document.getElementById('invoicePrefix').value || 'INV';
        if (taxRate < 0 || taxRate > 100) { this.showNotification('Tax rate must be 0–100', 'warning'); return; }
        localStorage.setItem('currency', currency);
        localStorage.setItem('taxRate', taxRate);
        localStorage.setItem('invoicePrefix', invoicePrefix);
        this.showNotification('✅ General settings saved!', 'success');
    }

    saveLowStockThreshold() {
        const threshold = parseInt(document.getElementById('lowStockThresholdSetting').value);
        if (!threshold || threshold < 1) { this.showNotification('Threshold must be ≥ 1', 'warning'); return; }
        this.lowStockThreshold = threshold;
        localStorage.setItem('lowStockThreshold', threshold);
        this.showNotification(`✅ Low stock threshold set to ${threshold}`, 'success');
        this.updateDashboard();
    }

    applyThemeFromSettings() {
        const selected = document.querySelector('input[name="appTheme"]:checked');
        if (!selected) return;
        this.applyTheme(selected.value);
        this.showNotification('✅ Theme applied!', 'success');
    }

    setCustomerType(type) {
        document.getElementById('customerType').value = type;
        const cashBtn = document.getElementById('typeCashBtn');
        const wsBtn = document.getElementById('typeWholesalerBtn');
        if (type === 'cash') {
            cashBtn.classList.add('btn-primary'); cashBtn.classList.remove('btn-secondary');
            wsBtn.classList.remove('btn-primary'); wsBtn.classList.add('btn-secondary');
        } else {
            wsBtn.classList.add('btn-primary'); wsBtn.classList.remove('btn-secondary');
            cashBtn.classList.remove('btn-primary'); cashBtn.classList.add('btn-secondary');
        }
    }

    saveCustomerAndProceed() {
        const name = document.getElementById('customerName').value.trim();
        const type = document.getElementById('customerType').value;
        if (!name) {
            this.showNotification('Customer name is required', 'warning');
            document.getElementById('customerName').focus();
            return;
        }
        if (!type) {
            this.showNotification('Please select customer type (Cash or Wholesaler)', 'warning');
            return;
        }
        this.switchBillingTab('cart');
        this.showNotification(`✓ Customer saved — now add items`, 'success');
    }

    // =====================
    // BILLING TAB (mobile)
    // =====================
    switchBillingTab(tab) {
        const customerBtn = document.getElementById('billingTabCustomer');
        const cartBtn = document.getElementById('billingTabCart');
        const formSection = document.getElementById('billingFormSection');
        const cartSection = document.getElementById('billingCartSection');
        // Update tab button states always
        if (customerBtn && cartBtn) {
            if (tab === 'customer') {
                customerBtn.classList.add('active');
                cartBtn.classList.remove('active');
            } else {
                cartBtn.classList.add('active');
                customerBtn.classList.remove('active');
            }
        }
        // Only toggle section visibility on mobile (where tabs are visible)
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) return; // desktop shows both panels always
        if (tab === 'customer') {
            if (formSection) { formSection.classList.add('tab-active'); }
            if (cartSection) { cartSection.classList.remove('tab-active'); }
        } else {
            if (cartSection) { cartSection.classList.add('tab-active'); }
            if (formSection) { formSection.classList.remove('tab-active'); }
        }
    }

    // =====================
    // THEME
    // =====================
    loadTheme() {
        const theme = localStorage.getItem('shopTheme') || 'dark';
        this.applyTheme(theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('shopTheme', theme);
        const btn = document.getElementById('themeToggle');
        const mobileBtn = document.getElementById('mobileThemeBtn');
        const icon = theme === 'dark' ? '☀️' : '🌙';
        if (btn) btn.textContent = icon;
        if (mobileBtn) mobileBtn.textContent = icon;
    }

    toggleTheme() {
        const current = localStorage.getItem('shopTheme') || 'dark';
        this.applyTheme(current === 'dark' ? 'light' : 'dark');
    }

    // =====================
    // DATA MANAGEMENT
    // =====================
    exportData() {
        try {
            const blob = new Blob([storage.exportData()], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shop-inventory-backup-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification('Data exported!', 'success');
        } catch (err) {
            this.showNotification('Export failed: ' + err.message, 'error');
        }
    }

    backupData() {
        try {
            localStorage.setItem('shop_backup_' + Date.now(), storage.exportData());
            this.showNotification('Backup saved to local storage!', 'success');
        } catch (err) {
            this.showNotification('Backup failed: ' + err.message, 'error');
        }
    }

    clearAllData() {
        if (confirm('⚠️ Delete ALL products and invoices? This cannot be undone!')) {
            if (confirm('Are you absolutely sure?')) {
                const uid = storage.currentUser;
                localStorage.removeItem(uid + '_products');
                localStorage.removeItem(uid + '_invoices');
                storage.initializeStorage();
                this.cartItems = [];
                this.updateDashboard();
                this.changePage('dashboard');
                this.showNotification('All data cleared!', 'success');
            }
        }
    }

    resetApp() {
        if (confirm('Reset all settings to default? (Data is preserved)')) {
            ['storeName','storeOwner','storeEmail','storePhone','storeAddress',
             'currency','taxRate','invoicePrefix','lowStockThreshold','shopTheme'].forEach(k => localStorage.removeItem(k));
            this.lowStockThreshold = 10;
            this.loadSettings();
            this.loadTheme();
            this.updateDashboard();
            this.changePage('dashboard');
            this.showNotification('App reset to defaults!', 'success');
        }
    }

    // =====================
    // UTILITIES
    // =====================
    setDateToToday() {
        const dateInput = document.getElementById('invoiceDate');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    }

    closeModal(modal) {
        if (modal) modal.classList.remove('active');
        this.closeCamera();
        if (this._postInvoiceDashboard && modal && modal.id === 'invoicePrintModal') {
            this._postInvoiceDashboard = false;
            this.changePage('dashboard');
        }
    }

    showNotification(message, type = 'success') {
        document.querySelectorAll('.notification').forEach(n => n.remove());
        const n = document.createElement('div');
        n.className = `notification ${type}`;
        n.style.cssText = 'animation: slideInRight 0.3s ease;';
        n.textContent = message;
        document.body.appendChild(n);
        setTimeout(() => {
            n.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => n.remove(), 300);
        }, 3000);
    }
}

// ---- BOOT ----
document.addEventListener('DOMContentLoaded', () => {
    const gateInput = document.getElementById('gateEmail');
    if (gateInput) {
        gateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitEmailGate();
        });
    }
    const newProfileEmailInput = document.getElementById('newProfileEmail');
    if (newProfileEmailInput) {
        newProfileEmailInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitNewProfile();
        });
    }

    checkProfileGate();
    window.app = new ShopApp();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
});
