// Storage Manager - Handles all local storage operations
class StorageManager {
    constructor() {
        this.currentUser = this.getCurrentUser();
        this.productsKey = this.currentUser + '_products';
        this.invoicesKey = this.currentUser + '_invoices';
        this.initializeStorage();
    }

    getCurrentUser() {
        return localStorage.getItem('activeProfile') || 'default';
    }

    switchUser(profileId) {
        localStorage.setItem('activeProfile', profileId);
        this.currentUser = profileId;
        this.productsKey = profileId + '_products';
        this.invoicesKey = profileId + '_invoices';
        this.initializeStorage();
    }

    getAllProfiles() {
        return JSON.parse(localStorage.getItem('allProfiles') || '[]');
    }

    addProfile(profile) {
        const profiles = this.getAllProfiles();
        if (profiles.find(p => p.id === profile.id)) return false;
        profiles.push(profile);
        localStorage.setItem('allProfiles', JSON.stringify(profiles));
        return true;
    }

    updateProfile(id, data) {
        const profiles = this.getAllProfiles();
        const idx = profiles.findIndex(p => p.id === id);
        if (idx === -1) return false;
        profiles[idx] = { ...profiles[idx], ...data };
        localStorage.setItem('allProfiles', JSON.stringify(profiles));
        return true;
    }

    deleteProfile(id) {
        let profiles = this.getAllProfiles();
        profiles = profiles.filter(p => p.id !== id);
        localStorage.setItem('allProfiles', JSON.stringify(profiles));
        localStorage.removeItem(id + '_products');
        localStorage.removeItem(id + '_invoices');
    }

    initializeStorage() {
        if (!localStorage.getItem(this.productsKey)) {
            localStorage.setItem(this.productsKey, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.invoicesKey)) {
            localStorage.setItem(this.invoicesKey, JSON.stringify([]));
        }
    }

    addProduct(product) {
        const products = this.getProducts();
        product.id = Date.now().toString();
        product.createdAt = new Date().toISOString();
        if (!product.colors) product.colors = [];
        // Normalize colors to [{name, qty}] format
        product.colors = product.colors.map(c =>
            typeof c === 'string' ? { name: c, qty: 0 } : c
        );
        products.push(product);
        localStorage.setItem(this.productsKey, JSON.stringify(products));
        return product;
    }

    getProducts() {
        const products = localStorage.getItem(this.productsKey);
        return products ? JSON.parse(products) : [];
    }

    getProductById(id) {
        const products = this.getProducts();
        return products.find(p => p.id === id);
    }

    updateProduct(id, updatedProduct) {
        let products = this.getProducts();
        products = products.map(p => p.id === id ? { ...p, ...updatedProduct } : p);
        localStorage.setItem(this.productsKey, JSON.stringify(products));
    }

    deleteProduct(id) {
        let products = this.getProducts();
        products = products.filter(p => p.id !== id);
        localStorage.setItem(this.productsKey, JSON.stringify(products));
    }

    searchProducts(query) {
        const products = this.getProducts();
        const lowerQuery = query.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(lowerQuery) ||
            p.sku.toLowerCase().includes(lowerQuery) ||
            (p.category && p.category.toLowerCase().includes(lowerQuery)) ||
            (p.colors && p.colors.some(c => {
                const name = typeof c === 'string' ? c : c.name;
                return name.toLowerCase().includes(lowerQuery);
            }))
        );
    }

    getLowStockProducts(threshold = 10) {
        return this.getProducts().filter(p => p.quantity < threshold);
    }

    updateStock(productId, newQuantity) {
        this.updateProduct(productId, { quantity: newQuantity });
    }

    removeColorFromProduct(productId, colorName, decrementQty = 1) {
        const p = this.getProductById(productId);
        if (!p || !p.colors) return;
        const colors = p.colors.map(c => {
            const name = typeof c === 'string' ? c : c.name;
            if (name.toLowerCase() === colorName.toLowerCase()) {
                const currentQty = typeof c === 'string' ? 0 : (c.qty || 0);
                const newQty = Math.max(0, currentQty - decrementQty);
                // Keep the colour in the array even at qty=0 so it shows up in reorder
                return { name, qty: newQty };
            }
            return typeof c === 'string' ? { name: c, qty: 0 } : c;
        });
        this.updateProduct(productId, { colors });
    }

    addInvoice(invoice) {
        const invoices = this.getInvoices();
        const prefix = localStorage.getItem('invoicePrefix') || 'INV';
        invoice.id = prefix + '-' + Date.now();
        invoice.createdAt = new Date().toISOString();
        invoices.push(invoice);
        localStorage.setItem(this.invoicesKey, JSON.stringify(invoices));
        return invoice;
    }

    getInvoices() {
        const invoices = localStorage.getItem(this.invoicesKey);
        return invoices ? JSON.parse(invoices) : [];
    }

    getInvoiceById(id) {
        const invoices = this.getInvoices();
        return invoices.find(inv => inv.id === id);
    }

    deleteInvoice(id) {
        let invoices = this.getInvoices();
        invoices = invoices.filter(inv => inv.id !== id);
        localStorage.setItem(this.invoicesKey, JSON.stringify(invoices));
    }

    searchInvoices(query) {
        const invoices = this.getInvoices();
        const lowerQuery = query.toLowerCase();
        return invoices.filter(inv =>
            inv.id.toLowerCase().includes(lowerQuery) ||
            (inv.customerName && inv.customerName.toLowerCase().includes(lowerQuery)) ||
            (inv.customerPhone && inv.customerPhone.includes(query))
        );
    }

    getTotalRevenue() {
        const invoices = this.getInvoices();
        return invoices.reduce((sum, inv) => {
            if (inv.type === 'purchase') return sum - (inv.total || 0);
            return sum + (inv.total || 0);
        }, 0);
    }

    getRecentInvoices(limit = 5) {
        const invoices = this.getInvoices();
        return invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
    }

    exportData() {
        const data = {
            products: this.getProducts(),
            invoices: this.getInvoices(),
            exportDate: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    }

    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.products) {
                localStorage.setItem(this.productsKey, JSON.stringify(data.products));
            }
            if (data.invoices) {
                localStorage.setItem(this.invoicesKey, JSON.stringify(data.invoices));
            }
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    clearAllData() {
        if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
            localStorage.removeItem(this.productsKey);
            localStorage.removeItem(this.invoicesKey);
            this.initializeStorage();
            return true;
        }
        return false;
    }
}

const storage = new StorageManager();
