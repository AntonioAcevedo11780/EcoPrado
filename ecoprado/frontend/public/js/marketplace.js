// Configuración
const API_URL = 'http://localhost:3001/api';
let currentUser = null;
let products = [];
let filteredProducts = [];

// Inicializar
async function initialize() {
    await loadUser();
    await loadProducts();
    setupEventListeners();
}

// Cargar usuario
async function loadUser() {
    try {
        const publicKey = localStorage.getItem('ecoprado_publicKey');
        if (publicKey) {
            const response = await fetch(`${API_URL}/users/${publicKey}`);
            if (response.ok) {
                currentUser = await response.json();
                updateUserInfo();
            }
        }
    } catch (error) {
        console.error('Error cargando usuario:', error);
    }
}

// Actualizar información del usuario
function updateUserInfo() {
    if (!currentUser) return;
    const balEl = document.getElementById('user-balance');
    const nameEl = document.getElementById('username');
    if (balEl) balEl.textContent = (currentUser.balance || 0).toFixed(2);
    if (nameEl) nameEl.textContent = currentUser.name || 'Usuario';
}

// Cargar productos (intenta JSON local; si no existe, cae a API)
async function loadProducts() {
    try {
        // JSON editable en frontend/public/data/products.json
        const localRes = await fetch('../public/data/products.json', { cache: 'no-store' });
        if (localRes.ok) {
            products = await localRes.json();
        } else {
            throw new Error('products.json no encontrado');
        }
    } catch (e) {
        try {
            const response = await fetch(`${API_URL}/marketplace`);
            products = await response.json();
        } catch (error) {
            console.error('Error cargando productos:', error);
            products = [];
        }
    }
    filteredProducts = [...products];
    renderProducts();
}

// Renderizar productos
function renderProducts() {
    const container = document.getElementById('products-container');
    
    if (filteredProducts.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">No hay productos disponibles</p></div>';
        return;
    }
    
    container.innerHTML = filteredProducts.map(product => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="product-card">
                <img src="${product.image}" alt="${product.name}" class="product-image">
                <div class="product-info">
                    <h5 class="product-title">${product.name}</h5>
                    <div class="product-price">
                        ${product.price}
                        <span class="product-price-unit">PRADONSITOS</span>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-ecoprado flex-fill" onclick="viewProduct(${product.id})">
                            <i class="bi bi-eye me-1"></i>
                            Ver Detalles
                        </button>
                        <button class="btn btn-ecoprado flex-fill" onclick="buyProduct(${product.id})" 
                                ${!currentUser || currentUser.balance < product.price ? 'disabled' : ''}>
                            <i class="bi bi-cart me-1"></i>
                            Comprar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Filtrar productos por categoría
function filterProducts(category) {
    if (category === 'all') {
        filteredProducts = [...products];
    } else {
        filteredProducts = products.filter(product => product.category === category);
    }
    
    // Actualizar botones de filtro
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderProducts();
}

// Ver producto
function viewProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
    document.getElementById('modal-product-image').src = product.image;
    document.getElementById('modal-product-title').textContent = product.name;
    document.getElementById('modal-product-price').textContent = `${product.price} PRADONSITOS`;
    document.getElementById('modal-product-description').textContent = getProductDescription(product);
    
    // Actualizar botón de compra
    const buyBtn = document.getElementById('modal-buy-btn');
    buyBtn.onclick = () => buyProduct(productId);
    buyBtn.disabled = !currentUser || currentUser.balance < product.price;
    
    modal.show();
}

// Obtener descripción del producto
function getProductDescription(product) {
    const descriptions = {
        'alimentos': 'Productos orgánicos y sostenibles cultivados localmente.',
        'educacion': 'Talleres y cursos para aprender sobre sostenibilidad.',
        'turismo': 'Experiencias ecológicas y turismo responsable.',
        'jardineria': 'Plantas nativas y herramientas para jardinería sostenible.',
        'transporte': 'Servicios de transporte público y opciones verdes.'
    };
    return descriptions[product.category] || 'Producto sostenible disponible en el marketplace.';
}

// Comprar producto
async function buyProduct(productId) {
    if (!currentUser) {
        Swal.fire({
            icon: 'warning',
            title: 'Inicia sesión',
            text: 'Por favor inicia sesión primero',
            confirmButtonText: 'Entendido'
        });
        return;
    }
    
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    if (currentUser.balance < product.price) {
        Swal.fire({
            icon: 'warning',
            title: 'Fondos insuficientes',
            text: 'No tienes suficientes Pradonsitos para comprar este producto',
            confirmButtonText: 'Entendido'
        });
        return;
    }
    
    const result = await Swal.fire({
        title: 'Confirmar compra',
        html: `
            <div class="text-center">
                <img src="${product.image}" alt="${product.name}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; margin-bottom: 1rem;">
                <h5>${product.name}</h5>
                <p class="text-muted">${getProductDescription(product)}</p>
                <div class="alert alert-info">
                    <strong>Precio:</strong> ${product.price} PRADONSITOS<br>
                    <strong>Tu balance:</strong> ${currentUser.balance.toFixed(2)} PRADONSITOS<br>
                    <strong>Balance después:</strong> ${(currentUser.balance - product.price).toFixed(2)} PRADONSITOS
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Comprar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0F2922',
        cancelButtonColor: '#6c757d'
    });
    
    if (result.isConfirmed) {
        try {
            const resp = await fetch(`${API_URL}/marketplace/purchase`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userPublicKey: currentUser.publicKey, itemId: productId })
            });
            const data = await resp.json();
            if (!resp.ok || !data.success) throw new Error(data.error || 'Compra rechazada');

            // Actualizar balance
            currentUser.balance = data.balance;
            updateUserInfo();

            Swal.fire({
                icon: 'success',
                title: 'Compra exitosa',
                html: `
                    <div class="text-center">
                        <h5>Has comprado "${product.name}"</h5>
                        <p class="text-muted">Por ${product.price} PRADONSITOS</p>
                        <div class="alert alert-success">
                            <strong>Nuevo balance:</strong> ${data.balance.toFixed(2)} PRADONSITOS<br>
                            <small>Hash anclado: ${data.order.anchorTxHash || 'N/A'}</small>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Listo'
            });

            const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
            if (modal) modal.hide();

        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message, confirmButtonText: 'Entendido' });
        }
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Filtros de categoría
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            filterProducts(category);
        });
    });
    
    // Botón de recargar balance
    document.getElementById('reload-balance').addEventListener('click', () => {
        loadUser();
    });
}

// Inicializar al cargar
window.addEventListener('DOMContentLoaded', initialize);
