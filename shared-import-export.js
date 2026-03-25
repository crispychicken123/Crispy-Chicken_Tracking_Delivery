// ملف JavaScript المشترك لوظائف الاستيراد والتصدير

class ImportExportManager {
    constructor() {
        this.data = {
            orders: [],
            branches: [],
            agents: [],
            settings: {}
        };
        this.loadData();
    }

    loadData() {
        try {
            const orders = localStorage.getItem('deliveryApp_orders');
            const branches = localStorage.getItem('deliveryApp_branches');
            const agents = localStorage.getItem('deliveryApp_agents');
            const settings = localStorage.getItem('deliveryApp_settings');

            if (orders) this.data.orders = JSON.parse(orders);
            if (branches) this.data.branches = JSON.parse(branches);
            if (agents) this.data.agents = JSON.parse(agents);
            if (settings) this.data.settings = JSON.parse(settings);
            
            return true;
        } catch (error) {
            console.error('Error loading data:', error);
            return false;
        }
    }

    saveData() {
        try {
            localStorage.setItem('deliveryApp_orders', JSON.stringify(this.data.orders));
            localStorage.setItem('deliveryApp_branches', JSON.stringify(this.data.branches));
            localStorage.setItem('deliveryApp_agents', JSON.stringify(this.data.agents));
            localStorage.setItem('deliveryApp_settings', JSON.stringify(this.data.settings));
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            return false;
        }
    }

    validateImportData(data, requiredFields = ['Order no', 'Cus. Name']) {
        if (!Array.isArray(data) || data.length === 0) {
            return { valid: false, error: 'No data found' };
        }

        const sample = data[0];
        const missingFields = requiredFields.filter(field => !sample.hasOwnProperty(field));
        
        if (missingFields.length > 0) {
            return { 
                valid: false, 
                error: `Missing required fields: ${missingFields.join(', ')}` 
            };
        }

        // تحقق من التكرارات
        const orderIds = new Set();
        const duplicates = [];
        
        data.forEach((item, index) => {
            if (orderIds.has(item['Order no'])) {
                duplicates.push({ index, orderId: item['Order no'] });
            } else {
                orderIds.add(item['Order no']);
            }
        });

        return { 
            valid: true, 
            duplicates,
            totalRecords: data.length 
        };
    }

    processImport(data, mode = 'merge') {
        const stats = {
            added: 0,
            updated: 0,
            skipped: 0,
            newBranches: 0,
            newAgents: 0,
            errors: []
        };

        data.forEach((newItem, index) => {
            try {
                // إضافة الطوابع الزمنية
                if (!newItem['Created Date']) {
                    newItem['Created Date'] = new Date().toISOString();
                }
                newItem['Last Updated'] = new Date().toISOString();
                
                // تعيين الحقول الافتراضية
                if (!newItem['status']) newItem['status'] = 'Pending';
                if (!newItem['Payment Status']) newItem['Payment Status'] = 'Pending';
                
                // البحث عن الطلب الموجود
                const existingIndex = this.data.orders.findIndex(
                    item => item['Order no'] === newItem['Order no']
                );
                
                if (existingIndex !== -1) {
                    // تحديث الطلب الموجود
                    if (mode === 'merge' || mode === 'replace') {
                        this.data.orders[existingIndex] = {
                            ...this.data.orders[existingIndex],
                            ...newItem
                        };
                        stats.updated++;
                    } else {
                        stats.skipped++;
                    }
                } else {
                    // إضافة طلب جديد
                    if (mode !== 'replace') {
                        this.data.orders.push(newItem);
                        stats.added++;
                    }
                }
                
                // إضافة الفروع والوكلاء الجدد
                if (newItem['Outlet'] && !this.data.branches.includes(newItem['Outlet'])) {
                    this.data.branches.push(newItem['Outlet']);
                    stats.newBranches++;
                }
                if (newItem['Agent Name'] && !this.data.agents.includes(newItem['Agent Name'])) {
                    this.data.agents.push(newItem['Agent Name']);
                    stats.newAgents++;
                }

            } catch (error) {
                stats.errors.push({
                    index,
                    orderId: newItem['Order no'],
                    error: error.message
                });
            }
        });

        // في وضع الاستبدال
        if (mode === 'replace') {
            this.data.orders = data;
            stats.added = data.length;
            stats.updated = 0;
        }

        this.saveData();
        return stats;
    }

    filterDataByDate(data, startDate, endDate) {
        if (!startDate || !endDate) return data;
        
        return data.filter(item => {
            const itemDate = new Date(item['Order Date']).toISOString().split('T')[0];
            return itemDate >= startDate && itemDate <= endDate;
        });
    }

    generateExportData(fields, filters = {}) {
        let filteredData = [...this.data.orders];
        
        // تطبيق الفلاتر
        if (filters.startDate && filters.endDate) {
            filteredData = this.filterDataByDate(filteredData, filters.startDate, filters.endDate);
        }
        
        if (filters.status && filters.status !== 'All') {
            filteredData = filteredData.filter(item => item.status === filters.status);
        }
        
        if (filters.agent && filters.agent !== 'All') {
            filteredData = filteredData.filter(item => item['Agent Name'] === filters.agent);
        }
        
        // اختيار الحقول المطلوبة
        return filteredData.map(item => {
            const exportItem = {};
            fields.forEach(field => {
                if (item[field] !== undefined) {
                    exportItem[field] = item[field];
                }
            });
            return exportItem;
        });
    }

    getStatistics() {
        return {
            totalOrders: this.data.orders.length,
            totalBranches: this.data.branches.length,
            totalAgents: this.data.agents.length,
            pendingOrders: this.data.orders.filter(o => o.status === 'Pending').length,
            deliveredOrders: this.data.orders.filter(o => o.status === 'Delivered').length,
            totalRevenue: this.data.orders
                .filter(o => o.status === 'Delivered')
                .reduce((sum, o) => sum + (parseFloat(o['Order Total']) || 0), 0)
        };
    }
}

// تصدير الكلاس للاستخدام في الملفات الأخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImportExportManager;
}
