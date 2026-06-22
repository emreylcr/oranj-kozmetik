const state = {
  token: localStorage.getItem("oranjToken") || "",
  user: JSON.parse(localStorage.getItem("oranjUser") || "null"),
  content: { products: [], categories: [], announcements: [], cmsSettings: {} },
  cart: JSON.parse(localStorage.getItem("oranjCart") || "[]"),
  productSearchTerm: "",
  discountSliderIndex: 0,
  discountSliderTimer: null,
  discountSliderAnimating: false,
  announcementSliderIndex: 0,
  announcementSliderTimer: null,
  announcementSliderAnimating: false
};

const el = {
  siteTitle: document.getElementById("siteTitle"),
  heroTitle: document.getElementById("heroTitle"),
  heroSubtitle: document.getElementById("heroSubtitle"),
  heroSection: document.getElementById("heroSection"),
  announcementSlider: document.getElementById("announcementSlider"),
  discountSlider: document.getElementById("discountSlider"),
  productSearchInput: document.getElementById("productSearchInput"),
  productGrid: document.getElementById("productGrid"),
  cartItems: document.getElementById("cartItems"),
  cartTotal: document.getElementById("cartTotal"),
  paymentMethod: document.getElementById("paymentMethod"),
  cardFields: document.getElementById("cardFields"),
  cardHolder: document.getElementById("cardHolder"),
  cardNumber: document.getElementById("cardNumber"),
  cardExpiry: document.getElementById("cardExpiry"),
  cardCvv: document.getElementById("cardCvv"),
  shippingAddress: document.getElementById("shippingAddress"),
  invoiceAddress: document.getElementById("invoiceAddress"),
  announcementList: document.getElementById("announcementList"),
  adminPanel: document.getElementById("adminPanel"),
  customerPanel: document.getElementById("customerPanel"),
  adminTabButton: document.getElementById("adminTabButton"),
  userList: document.getElementById("userList"),
  adminProductList: document.getElementById("adminProductList"),
  categoryList: document.getElementById("categoryList"),
  orderList: document.getElementById("orderList"),
  emailHistory: document.getElementById("emailHistory"),
  adminAnnouncements: document.getElementById("adminAnnouncements"),
  myOrders: document.getElementById("myOrders"),
  trackingResult: document.getElementById("trackingResult"),
  lastOrderInfo: document.getElementById("lastOrderInfo"),
  orderSearchInput: document.getElementById("orderSearchInput"),
  productCategorySelect: document.getElementById("productCategorySelect"),
  discountProductId: document.getElementById("discountProductId"),
  discountOldPrice: document.getElementById("discountOldPrice"),
  discountNewPrice: document.getElementById("discountNewPrice"),
  discountInSlider: document.getElementById("discountInSlider"),
  discountList: document.getElementById("discountList"),
  quickCartBtn: document.getElementById("quickCartBtn"),
  quickCartCount: document.getElementById("quickCartCount"),
  quickCartPanel: document.getElementById("quickCartPanel"),
  productBottomSheet: document.getElementById("productBottomSheet"),
  productSheetContent: document.getElementById("productSheetContent"),
  closeProductSheetBtn: document.getElementById("closeProductSheetBtn"),
  stockSummary: document.getElementById("stockSummary"),
  openStockModalBtn: document.getElementById("openStockModalBtn"),
  stockModalOverlay: document.getElementById("stockModalOverlay"),
  closeStockDialog: document.getElementById("closeStockDialog"),
  stockSearchInput: document.getElementById("stockSearchInput"),
  stockModalList: document.getElementById("stockModalList"),
  forumFormWrap: document.getElementById("forumFormWrap"),
  forumForm: document.getElementById("forumForm"),
  forumProductSelect: document.getElementById("forumProductSelect"),
  forumStarRating: document.getElementById("forumStarRating"),
  forumRatingInput: document.getElementById("forumRatingInput"),
  forumCommentInput: document.getElementById("forumCommentInput"),
  forumLoginHint: document.getElementById("forumLoginHint"),
  forumNoPurchaseHint: document.getElementById("forumNoPurchaseHint"),
  forumPostList: document.getElementById("forumPostList"),
  toast: document.getElementById("toast")
};

let adminStockProducts = [];
let adminStockCategories = [];

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  setTimeout(() => el.toast.classList.add("hidden"), 2400);
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Bir hata oluştu");
  return data;
}

function formatTl(value) {
  return `${Number(value).toFixed(2)} TL`;
}

function getOldPrice(product) {
  return Number(product.oldPrice ?? product.price);
}

function getCurrentPrice(product) {
  const oldPrice = getOldPrice(product);
  const discount = product.discountPrice === null || product.discountPrice === undefined
    ? null
    : Number(product.discountPrice);
  if (discount && discount > 0 && discount < oldPrice) return discount;
  return Number(product.price);
}

function getDiscountPercent(product) {
  const oldPrice = getOldPrice(product);
  const current = getCurrentPrice(product);
  if (current >= oldPrice) return 0;
  return Math.round(((oldPrice - current) / oldPrice) * 100);
}

function getDiscountedSliderProducts() {
  return state.content.products
    .filter((p) => getDiscountPercent(p) > 0 && p.inDiscountSlider)
    .slice(0, 6);
}

function getAnnouncementSliderItems() {
  return (state.content.announcements || []).filter((a) => a.inAnnouncementSlider);
}

function persistCart() {
  localStorage.setItem("oranjCart", JSON.stringify(state.cart));
}

function renderQuickCart() {
  if (!el.quickCartCount || !el.quickCartPanel) return;
  const count = state.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  el.quickCartCount.textContent = String(count);

  if (!state.cart.length) {
    el.quickCartPanel.innerHTML = "<p>Sepetiniz boş.</p>";
    return;
  }

  const lines = state.cart
    .map((line) => {
      const product = state.content.products.find((p) => p.id === line.productId);
      if (!product) return "";
      return `<div class="item"><strong>${trText(product.name)}</strong><br/>Adet: ${line.quantity}
        <button class="btn danger" data-quick-remove="${line.productId}" style="margin-top:6px;">Çıkar</button>
      </div>`;
    })
    .filter(Boolean)
    .join("");

  el.quickCartPanel.innerHTML = `
    ${lines}
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
      <button class="btn" id="quickGoCartBtn">Sepete Git</button>
      <button class="btn danger" id="quickClearCartBtn">Sepeti Sıfırla</button>
    </div>
  `;

  const quickGoCartBtn = document.getElementById("quickGoCartBtn");
  if (quickGoCartBtn) {
    quickGoCartBtn.addEventListener("click", () => {
      switchCustomerTab("cart");
      el.quickCartPanel.classList.add("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  document.querySelectorAll("[data-quick-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.cart = state.cart.filter((item) => item.productId !== btn.dataset.quickRemove);
      persistCart();
      renderCart();
      renderQuickCart();
      toast("Ürün mini sepetten çıkarıldı.");
    });
  });

  const quickClearCartBtn = document.getElementById("quickClearCartBtn");
  if (quickClearCartBtn) {
    quickClearCartBtn.addEventListener("click", () => {
      state.cart = [];
      persistCart();
      renderCart();
      renderQuickCart();
      toast("Sepet sıfırlandı.");
    });
  }
}

function setDiscountOldPriceFromSelected() {
  const productId = el.discountProductId.value;
  const product = state.content.products.find((p) => p.id === productId);
  if (!product) {
    el.discountOldPrice.value = "";
    return;
  }
  el.discountOldPrice.value = formatTl(getOldPrice(product));
}

function buildProductSheetContent(product) {
  if (!el.productBottomSheet || !el.productSheetContent) return;
  const oldPrice = getOldPrice(product);
  const currentPrice = getCurrentPrice(product);
  const discount = getDiscountPercent(product);
  const code = product.variants?.[0]?.code || "-";
  const maxQty = Math.min(24, Math.max(1, Number(product.stock) || 1));

  el.productSheetContent.innerHTML = `
    <div class="item">
      <h3>${trText(product.name)}</h3>
      <p><strong>Ürün Kodu:</strong> ${product.id}</p>
      <p><strong>Boya Kodu:</strong> ${code}</p>
      <p><strong>Stok:</strong> ${product.stock}</p>
      <p>${trText(product.description)}</p>
      <p><strong>Özellikler:</strong> Kalıcı renk, parlak görünüm, profesyonel kullanım.</p>
      <p>
        <span class="old-price">${formatTl(oldPrice)}</span>
        <span class="new-price">${formatTl(currentPrice)}</span>
        ${discount > 0 ? `<span class="discount-badge">%${discount} İndirim</span>` : ""}
      </p>
      <div class="qty-line">
        <input id="sheetQtyInput" type="number" min="1" max="${maxQty}" value="1" />
        <button id="sheetAddCartBtn" class="btn">Sepete Ekle</button>
      </div>
    </div>
  `;

  const addBtn = document.getElementById("sheetAddCartBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const qty = Number(document.getElementById("sheetQtyInput")?.value || 1);
      if (qty < 1) return toast("Adet en az 1 olmalı.");
      if (qty > maxQty) return toast(`En fazla ${maxQty} adet ekleyebilirsiniz.`);
      addToCart(product.id, qty);
    });
  }
}

function renderProductDetailSheet(product) {
  if (!el.productBottomSheet || !el.productSheetContent) return;
  const isHidden = el.productBottomSheet.classList.contains("hidden");
  if (isHidden) {
    buildProductSheetContent(product);
    el.productBottomSheet.classList.remove("hidden");
    el.productBottomSheet.classList.remove("closing");
    el.productSheetContent.classList.remove("sheet-content-out");
    el.productSheetContent.classList.add("sheet-content-in");
    setTimeout(() => el.productSheetContent.classList.remove("sheet-content-in"), 320);
    return;
  }

  el.productSheetContent.classList.remove("sheet-content-in");
  el.productSheetContent.classList.add("sheet-content-out");
  setTimeout(() => {
    buildProductSheetContent(product);
    el.productSheetContent.classList.remove("sheet-content-out");
    el.productSheetContent.classList.add("sheet-content-in");
    setTimeout(() => el.productSheetContent.classList.remove("sheet-content-in"), 340);
  }, 200);
}

function closeProductSheet() {
  if (!el.productBottomSheet) return;
  if (el.productBottomSheet.classList.contains("hidden")) return;
  el.productBottomSheet.classList.add("closing");
  setTimeout(() => {
    el.productBottomSheet.classList.add("hidden");
    el.productBottomSheet.classList.remove("closing");
  }, 220);
}

function trText(value = "") {
  return String(value)
    .replaceAll("Guzelligini", "Güzelliğini")
    .replaceAll("Kalici", "Kalıcı")
    .replaceAll("Amonyaksiz", "Amonyaksız")
    .replaceAll("Bitkisel Dogal", "Bitkisel Doğal")
    .replaceAll("sac boyasi", "saç boyası")
    .replaceAll("Sac Boyasi", "Saç Boyası")
    .replaceAll("yuksek", "yüksek")
    .replaceAll("kapaticilik", "kapatıcılık")
    .replaceAll("profesyonel", "profesyonel")
    .replaceAll("tonunda", "tonunda");
}

function getHairDyeColorByCode(code, productName = "") {
  const palette = {
    "1.0": "#1f1512",
    "2.0": "#2f1e18",
    "3.0": "#4a2d21",
    "4.0": "#5b3a2b",
    "5.0": "#704631",
    "6.0": "#8a5a3f",
    "7.0": "#a46d47",
    "8.0": "#c28a58",
    "9.0": "#deb67f",
    "10.0": "#f1d6a5"
  };
  let base = palette[code] || "#7a4b38";
  if (productName.includes("Amonyaksız")) {
    base = palette[code] || "#915c43";
  } else if (productName.includes("Bitkisel")) {
    base = palette[code] || "#7b5a3c";
  }
  return base;
}

function hairDyeImage(product) {
  const code = product.variants?.[0]?.code || "0.0";
  const dyeColor = getHairDyeColorByCode(code, product.name);
  const safeName = trText(product.name || "Saç Boyası").replace(/&/g, "&amp;");
  const safeCode = String(code).replace(/&/g, "&amp;");
  const svg = `
  <svg xmlns='http://www.w3.org/2000/svg' width='700' height='500' viewBox='0 0 700 500'>
    <defs>
      <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#ffe9f5'/>
        <stop offset='100%' stop-color='#ffd1e8'/>
      </linearGradient>
      <linearGradient id='box' x1='0' y1='0' x2='0' y2='1'>
        <stop offset='0%' stop-color='${dyeColor}'/>
        <stop offset='100%' stop-color='#1a1a1a'/>
      </linearGradient>
    </defs>
    <rect width='700' height='500' fill='url(#bg)'/>
    <rect x='210' y='60' width='280' height='380' rx='18' fill='url(#box)' stroke='#ffffff' stroke-width='4'/>
    <rect x='238' y='95' width='224' height='56' rx='10' fill='#ffffff' opacity='0.92'/>
    <text x='350' y='130' text-anchor='middle' fill='#9d174d' font-size='26' font-family='Arial' font-weight='700'>ORANJ KOZMETİK</text>
    <text x='350' y='225' text-anchor='middle' fill='#ffffff' font-size='44' font-family='Arial' font-weight='700'>SAÇ BOYASI</text>
    <text x='350' y='280' text-anchor='middle' fill='#ffd9eb' font-size='30' font-family='Arial'>KOD ${safeCode}</text>
    <text x='350' y='340' text-anchor='middle' fill='#ffe9f5' font-size='19' font-family='Arial'>${safeName}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function applyCms(settings = {}) {
  el.siteTitle.textContent = trText(settings.siteTitle || "Oranj Kozmetik");
  el.heroTitle.textContent = trText(settings.heroTitle || "Güzelliğini Renklendir");
  el.heroSubtitle.textContent = trText(settings.heroSubtitle || "");
  document.documentElement.style.setProperty("--primary", settings.primaryColor || "#be185d");
  document.documentElement.style.setProperty("--accent", settings.accentColor || "#fb7185");
  if (settings.bannerImage) {
    el.heroSection.style.backgroundImage = `linear-gradient(110deg, rgba(190, 24, 93, 0.6), rgba(251, 113, 133, 0.55)), url('${settings.bannerImage}')`;
    el.heroSection.style.backgroundSize = "cover";
    el.heroSection.style.backgroundPosition = "center";
  }
}

function renderAnnouncementSlider() {
  const items = getAnnouncementSliderItems();
  if (!items.length) {
    el.announcementSlider.innerHTML = "<div class='item'>Aktif kayan duyuru yok.</div>";
    if (state.announcementSliderTimer) {
      clearInterval(state.announcementSliderTimer);
      state.announcementSliderTimer = null;
    }
    return;
  }

  if (state.announcementSliderIndex >= items.length) state.announcementSliderIndex = 0;
  const currentItem = items[state.announcementSliderIndex];
  const slideHtml = (item) => `
    <article class="announcement-slide">
      <div>
        <h3>${trText(item.title)}</h3>
        <p>${trText(item.content)}</p>
      </div>
    </article>
  `;

  el.announcementSlider.innerHTML = `<div class="discount-track">${slideHtml(currentItem)}</div>`;

  if (state.announcementSliderTimer) {
    clearInterval(state.announcementSliderTimer);
    state.announcementSliderTimer = null;
  }

  if (items.length > 1) {
    state.announcementSliderTimer = setInterval(() => {
      const currentItems = getAnnouncementSliderItems();
      if (state.announcementSliderAnimating || currentItems.length < 2) return;
      if (state.announcementSliderIndex >= currentItems.length) state.announcementSliderIndex = 0;
      const current = currentItems[state.announcementSliderIndex];
      const nextIndex = (state.announcementSliderIndex + 1) % currentItems.length;
      const next = currentItems[nextIndex];

      state.announcementSliderAnimating = true;
      el.announcementSlider.innerHTML = `
        <div class="discount-track slide-stage" id="announcementTrackStage">
          <div class="discount-panel">${slideHtml(current)}</div>
          <div class="discount-panel">${slideHtml(next)}</div>
        </div>
      `;

      requestAnimationFrame(() => {
        const stage = document.getElementById("announcementTrackStage");
        if (stage) stage.classList.add("slide-left");
      });

      setTimeout(() => {
        state.announcementSliderIndex = nextIndex;
        state.announcementSliderAnimating = false;
        renderAnnouncementSlider();
      }, 1550);
    }, 5000);
  }
}

function renderDiscountSlider() {
  const products = getDiscountedSliderProducts();
  if (!products.length) {
    el.discountSlider.innerHTML = "<div class='item'>Şu anda aktif kayan indirim ürünü yok.</div>";
    if (state.discountSliderTimer) {
      clearInterval(state.discountSliderTimer);
      state.discountSliderTimer = null;
    }
    return;
  }

  if (state.discountSliderIndex >= products.length) state.discountSliderIndex = 0;
  const product = products[state.discountSliderIndex];

  const slideHtml = (item) => {
    const oldPrice = getOldPrice(item);
    const newPrice = getCurrentPrice(item);
    const percent = getDiscountPercent(item);
    const firstVariant = item.variants?.[0]?.code || "-";
    return `
      <article class="discount-slide">
        <img src="${hairDyeImage(item)}" alt="${trText(item.name)}" />
        <div>
          <h3>${trText(item.name)}</h3>
          <p>${trText(item.description)}</p>
          <p><strong>Boya No:</strong> ${firstVariant}</p>
          <p>
            <span class="old-price">${formatTl(oldPrice)}</span>
            <span class="new-price">${formatTl(newPrice)}</span>
          </p>
          <span class="discount-badge">%${percent} İndirim</span>
        </div>
      </article>
    `;
  };

  el.discountSlider.innerHTML = `<div class="discount-track">${slideHtml(product)}</div>`;

  if (state.discountSliderTimer) {
    clearInterval(state.discountSliderTimer);
    state.discountSliderTimer = null;
  }

  if (products.length > 1) {
    state.discountSliderTimer = setInterval(() => {
      const currentProducts = getDiscountedSliderProducts();
      if (state.discountSliderAnimating || currentProducts.length < 2) return;
      if (state.discountSliderIndex >= currentProducts.length) state.discountSliderIndex = 0;

      const current = currentProducts[state.discountSliderIndex];
      const nextIndex = (state.discountSliderIndex + 1) % currentProducts.length;
      const next = currentProducts[nextIndex];

      state.discountSliderAnimating = true;
      el.discountSlider.innerHTML = `
        <div class="discount-track slide-stage" id="discountTrackStage">
          <div class="discount-panel">${slideHtml(current)}</div>
          <div class="discount-panel">${slideHtml(next)}</div>
        </div>
      `;

      requestAnimationFrame(() => {
        const stage = document.getElementById("discountTrackStage");
        if (stage) stage.classList.add("slide-left");
      });

      setTimeout(() => {
        state.discountSliderIndex = nextIndex;
        state.discountSliderAnimating = false;
        renderDiscountSlider();
      }, 1550);
    }, 5000);
  }
}

function renderProducts() {
  el.productGrid.innerHTML = "";
  const filteredProducts = state.content.products.filter((product) => {
    const term = state.productSearchTerm.trim().toLowerCase();
    if (!term) return true;
    const nameMatch = trText(product.name).toLowerCase().includes(term);
    const codes = (product.variants || []).map((v) => String(v.code || "").toLowerCase());
    const codeMatch = codes.some((code) => code.includes(term));
    return nameMatch || codeMatch;
  });

  if (!filteredProducts.length) {
    el.productGrid.innerHTML = "<p>Aramanıza uygun ürün bulunamadı.</p>";
    return;
  }

  filteredProducts.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card clickable";
    card.dataset.openProduct = product.id;
    const firstVariant = product.variants?.[0]?.code || "-";
    const oldPrice = getOldPrice(product);
    const newPrice = getCurrentPrice(product);
    const discountPercent = getDiscountPercent(product);
    const priceHtml =
      discountPercent > 0
        ? `<span class="old-price">${formatTl(oldPrice)}</span><span class="new-price">${formatTl(newPrice)}</span> <span class="discount-badge">%${discountPercent}</span>`
        : `<span>${formatTl(newPrice)}</span>`;
    const maxQty = Math.min(24, Math.max(1, Number(product.stock) || 1));
    card.innerHTML = `
      <img src="${product.imageUrl}" alt="${product.name}" />
      <div class="content">
        <h4>${trText(product.name)}</h4>
        <p>${trText(product.description)}</p>
        <p><strong>Boya No:</strong> ${firstVariant}</p>
        <p><strong>Stok:</strong> ${product.stock} | <strong>Fiyat:</strong> ${priceHtml}</p>
        <div class="add-row">
          <input type="number" min="1" max="${maxQty}" value="1" data-qty-input="${product.id}" />
          <button class="btn" data-add-cart="${product.id}">Sepete Ekle</button>
        </div>
      </div>
    `;
    const image = card.querySelector("img");
    image.src = hairDyeImage(product);
    el.productGrid.appendChild(card);
  });

  document.querySelectorAll("[data-add-cart]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const qtyInput = document.querySelector(`[data-qty-input="${btn.dataset.addCart}"]`);
      const qty = Number(qtyInput?.value || 1);
      addToCart(btn.dataset.addCart, qty);
    });
  });

  document.querySelectorAll("[data-open-product]").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.openProduct;
      const product = state.content.products.find((p) => p.id === id);
      if (!product) return;
      renderProductDetailSheet(product);
    });
  });

  document.querySelectorAll("[data-qty-input]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("focus", (event) => event.stopPropagation());
    input.addEventListener("mousedown", (event) => event.stopPropagation());
  });
}

function addToCart(productId, quantity = 1) {
  const product = state.content.products.find((item) => item.id === productId);
  if (!product) return;
  const safeQty = Math.max(1, Math.min(24, Math.floor(Number(quantity) || 1)));
  const existing = state.cart.find((item) => item.productId === productId);
  if (existing) existing.quantity += safeQty;
  else state.cart.push({ productId, quantity: safeQty });
  persistCart();
  renderCart();
  renderQuickCart();
  toast(`${safeQty} adet ürün sepete eklendi.`);
}

function renderCart() {
  el.cartItems.innerHTML = "";
  let total = 0;
  state.cart.forEach((line) => {
    const product = state.content.products.find((item) => item.id === line.productId);
    if (!product) return;
    const unitPrice = getCurrentPrice(product);
    total += unitPrice * line.quantity;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <strong>${product.name}</strong><br />
      Adet: ${line.quantity} - Ara Toplam: ${formatTl(unitPrice * line.quantity)}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
        <button class="btn outline" data-inc-cart="${line.productId}">+1</button>
        <button class="btn outline" data-dec-cart="${line.productId}">-1</button>
        <button class="btn danger" data-remove-cart-all="${line.productId}">Tümünü Sil</button>
      </div>
    `;
    el.cartItems.appendChild(div);
  });
  if (!state.cart.length) el.cartItems.innerHTML = "<p>Sepetinizde ürün yok.</p>";
  el.cartTotal.textContent = formatTl(total);
  document.querySelectorAll("[data-inc-cart]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = state.cart.find((i) => i.productId === btn.dataset.incCart);
      if (!item) return;
      item.quantity += 1;
      persistCart();
      renderCart();
      renderQuickCart();
    });
  });
  document.querySelectorAll("[data-dec-cart]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = state.cart.find((i) => i.productId === btn.dataset.decCart);
      if (!item) return;
      item.quantity -= 1;
      if (item.quantity <= 0) {
        state.cart = state.cart.filter((i) => i.productId !== btn.dataset.decCart);
      }
      persistCart();
      renderCart();
      renderQuickCart();
    });
  });
  document.querySelectorAll("[data-remove-cart-all]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.cart = state.cart.filter((item) => item.productId !== btn.dataset.removeCartAll);
      persistCart();
      renderCart();
      renderQuickCart();
    });
  });
}

function renderAnnouncements() {
  el.announcementList.innerHTML = state.content.announcements
    .map(
      (a) => `
      <div class="item">
        <strong>${trText(a.title)}</strong>
        <p>${trText(a.content)}</p>
      </div>
    `
    )
    .join("");
}

function renderCustomerOrders(orders) {
  if (!orders.length) {
    el.myOrders.innerHTML = "<p>Henüz siparişiniz yok.</p>";
    return;
  }
  el.myOrders.innerHTML = orders
    .map(
      (o) => `
      <div class="item">
        <strong>Sipariş No:</strong> ${o.orderNumber || o.id}<br />
        Durum: ${o.status} - Takip Kodu: ${o.trackingCode}<br />
        Tutar: ${formatTl(o.totalPrice)}
      </div>
    `
    )
    .join("");
}

function showTrackingResult(order) {
  el.trackingResult.innerHTML = `
    <div class="item">
      <strong>Sipariş No:</strong> ${order.orderNumber || order.id}<br />
      <strong>Durum:</strong> ${order.status}<br />
      <strong>Takip Kodu:</strong> ${order.trackingCode}<br />
      <strong>Tutar:</strong> ${formatTl(order.totalPrice)}
    </div>
  `;
}

function formatForumDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderStarDisplay(rating) {
  const stars = Math.max(0, Math.min(5, Number(rating) || 0));
  return Array.from({ length: 5 }, (_, index) => {
    const filled = index < stars;
    return `<span class="${filled ? "" : "star-empty"}">★</span>`;
  }).join("");
}

function setForumRating(rating) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  el.forumStarRating.dataset.rating = String(value);
  el.forumRatingInput.value = String(value);
  el.forumStarRating.querySelectorAll(".star-btn").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.star) <= value);
  });
}

function renderForumPosts(posts) {
  if (!posts.length) {
    el.forumPostList.innerHTML = "<p class=\"hint\">Henuz yorum yok. Ilk yorumu siz yazin.</p>";
    return;
  }

  el.forumPostList.innerHTML = posts
    .map(
      (post) => `
      <article class="forum-post-card">
        <div class="forum-post-meta">
          <strong>@${post.username}</strong>
          <span>${formatForumDate(post.createdAt)}</span>
          <span class="forum-post-product">${trText(post.productName)}</span>
          <span class="star-display" aria-label="${post.rating} yildiz">${renderStarDisplay(post.rating)}</span>
        </div>
        <p>${trText(post.comment)}</p>
      </article>
    `
    )
    .join("");
}

async function loadForum() {
  try {
    const data = await api("/api/customer/forum");
    renderForumPosts(data.posts || []);
  } catch (error) {
    el.forumPostList.innerHTML = `<p class="hint">${error.message}</p>`;
  }

  el.forumFormWrap.classList.add("hidden");
  el.forumLoginHint.classList.add("hidden");
  el.forumNoPurchaseHint.classList.add("hidden");

  if (!state.user) {
    el.forumLoginHint.classList.remove("hidden");
    return;
  }

  try {
    const purchasedData = await api("/api/customer/forum/purchased-products");
    const products = purchasedData.products || [];
    if (!products.length) {
      el.forumNoPurchaseHint.classList.remove("hidden");
      return;
    }

    el.forumProductSelect.innerHTML = products
      .map((product) => `<option value="${product.id}">${trText(product.name)}</option>`)
      .join("");
    el.forumFormWrap.classList.remove("hidden");
  } catch (error) {
    el.forumNoPurchaseHint.textContent = error.message;
    el.forumNoPurchaseHint.classList.remove("hidden");
  }
}

function switchCustomerTab(tab) {
  document.querySelectorAll("[data-customer-tab]").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
  if (tab !== "payment") {
    document.querySelector(`[data-customer-tab="${tab}"]`)?.classList.add("active");
  }
  if (tab === "products") document.getElementById("customerProducts").classList.add("active");
  if (tab === "cart") document.getElementById("customerCart").classList.add("active");
  if (tab === "payment") document.getElementById("customerPayment").classList.add("active");
  if (tab === "tracking") document.getElementById("customerTracking").classList.add("active");
  if (tab === "announcements") document.getElementById("customerAnnouncements").classList.add("active");
  if (tab === "forum") {
    document.getElementById("customerForum").classList.add("active");
    loadForum();
  }
}

function fillCategorySelect() {
  el.productCategorySelect.innerHTML = state.content.categories
    .map((c) => `<option value="${c.id}">${trText(c.name)}</option>`)
    .join("");
}

function updateAuthUi() {
  const isLoggedIn = Boolean(state.user);
  document.getElementById("logoutBtn").classList.toggle("hidden", !isLoggedIn);
  document.getElementById("showLoginBtn").classList.toggle("hidden", isLoggedIn);
  document.getElementById("showRegisterBtn").classList.toggle("hidden", isLoggedIn);
  const isAdmin = state.user?.role === "admin";
  el.adminTabButton.classList.toggle("hidden", !isAdmin);
}

function updatePaymentMethodUi() {
  const method = el.paymentMethod.value;
  const requiresCard = method === "banka_karti" || method === "kredi_karti";
  el.cardFields.classList.toggle("hidden", !requiresCard);
}

function normalizeCardInput(value) {
  return value.replace(/\D/g, "").slice(0, 16);
}

function normalizeCardHolderInput(value) {
  return value
    .replace(/[0-9]/g, "")
    .replace(/[^\p{L}\s]/gu, "")
    .replace(/\s{2,}/g, " ");
}

function blockNonDigitKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
  if (allowed.includes(event.key)) return;
  if (event.key.length === 1 && !/^\d$/.test(event.key)) event.preventDefault();
}

function blockNonLetterKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End", " "];
  if (allowed.includes(event.key)) return;
  if (event.key.length === 1 && !/^\p{L}$/u.test(event.key)) event.preventDefault();
}

function formatCardNumber(value) {
  return value.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function validatePayment() {
  const method = el.paymentMethod.value;
  const shippingAddress = el.shippingAddress.value.trim();
  const invoiceAddress = el.invoiceAddress.value.trim();

  if (!shippingAddress) throw new Error("Teslimat adresi zorunludur.");
  if (!invoiceAddress) throw new Error("Fatura adresi zorunludur.");

  const payment = { method };
  if (method === "banka_karti" || method === "kredi_karti") {
    const cardHolder = normalizeCardHolderInput(el.cardHolder.value).trim();
    const cardNumberRaw = normalizeCardInput(el.cardNumber.value);
    const expiry = el.cardExpiry.value.trim();
    const cvv = el.cardCvv.value.trim();
    if (!cardHolder || cardHolder.length < 5 || /\d/.test(cardHolder) || !/^[\p{L}\s]+$/u.test(cardHolder)) {
      throw new Error("Kart sahibi adi sadece harf icermelidir.");
    }
    if (!/^\d{16}$/.test(cardNumberRaw)) throw new Error("Kart numarasi 16 haneli olmalidir.");
    if (!/^\d{2}\/\d{2}$/.test(expiry)) throw new Error("SKT formati AA/YY olmali.");
    if (!/^\d{3}$/.test(cvv)) throw new Error("CVV 3 haneli olmali.");
    const [mmText, yyText] = expiry.split("/");
    const month = Number(mmText);
    const year = 2000 + Number(yyText);
    if (month < 1 || month > 12) throw new Error("SKT ay bilgisi gecersiz.");
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      throw new Error("Gecmis tarihli kart kabul edilmez.");
    }
    payment.cardHolder = cardHolder;
    payment.cardNumber = cardNumberRaw;
    payment.expiry = expiry;
    payment.cvv = cvv;
  }

  return { payment, shippingAddress, invoiceAddress };
}

async function loadCustomerContent() {
  const content = await api("/api/customer/content");
  state.content = content;
  applyCms(content.cmsSettings);
  renderAnnouncementSlider();
  renderDiscountSlider();
  renderProducts();
  renderCart();
  renderQuickCart();
  renderAnnouncements();
  fillCategorySelect();
}

async function refreshAdminDashboard() {
  if (state.user?.role !== "admin") return;
  const db = await api("/api/admin/dashboard");

  el.userList.innerHTML = db.users
    .map(
      (u) => `
      <div class="item">
        ${u.username} (${u.role}) - ${u.email}
        <button class="btn danger" data-del-user="${u.id}" ${u.username === "admin" ? "disabled" : ""}>Sil</button>
      </div>
    `
    )
    .join("");

  el.adminProductList.innerHTML =
    db.products
      .slice(0, 12)
      .map(
        (p) => `
      <div class="item admin-product-compact">
        <div>
          <strong>${trText(p.name)}</strong>
          <span class="hint"> — ${formatTl(p.price)}</span>
        </div>
        <button class="btn danger" data-del-product="${p.id}">Kaldir</button>
      </div>
    `
      )
      .join("") +
    (db.products.length > 12
      ? `<p class="hint">+${db.products.length - 12} urun daha. Stok icin "Stoktaki Urunler" butonunu kullanin.</p>`
      : "");

  adminStockProducts = db.products;
  adminStockCategories = db.categories;
  const totalStock = db.products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  const lowStockCount = db.products.filter((p) => Number(p.stock) <= 5).length;
  el.stockSummary.textContent = `${db.products.length} urun, toplam ${totalStock} adet stok${lowStockCount ? ` (${lowStockCount} dusuk stok)` : ""}.`;
  if (!el.stockModalOverlay?.classList.contains("hidden")) {
    renderStockModalList(el.stockSearchInput?.value || "");
  }

  el.discountProductId.innerHTML = db.products
    .map((p) => `<option value="${p.id}">${trText(p.name)}</option>`)
    .join("");
  setDiscountOldPriceFromSelected();

  const discountedProducts = db.products.filter((p) => getDiscountPercent(p) > 0);
  el.discountList.innerHTML = discountedProducts.length
    ? discountedProducts
        .map((p) => {
          const oldPrice = getOldPrice(p);
          const newPrice = getCurrentPrice(p);
          const percent = getDiscountPercent(p);
          return `
            <div class="item">
              <strong>${trText(p.name)}</strong><br />
              <span class="old-price">${formatTl(oldPrice)}</span>
              <span class="new-price">${formatTl(newPrice)}</span>
              <span class="discount-badge">%${percent}</span><br />
              Slider: ${p.inDiscountSlider ? "Evet" : "Hayır"}
              <button class="btn danger" data-clear-discount="${p.id}">İndirimi Kaldır</button>
            </div>
          `;
        })
        .join("")
    : "<p>Henüz indirimli ürün yok.</p>";

  el.categoryList.innerHTML = db.categories.map((c) => `<div class="item">${trText(c.name)}</div>`).join("");

  el.orderList.innerHTML = db.orders
    .map(
      (o) => `
      <div class="item">
        <strong>${o.orderNumber || o.id}</strong> - ${o.customerUsername} - ${formatTl(o.totalPrice)}<br />
        Durum:
        <select data-order-status="${o.id}">
          ${["Hazirlaniyor", "Kargoda", "Teslim Edildi", "Iptal"]
            .map((s) => `<option ${o.status === s ? "selected" : ""}>${s}</option>`)
            .join("")}
        </select>
        <button class="btn outline" data-save-order="${o.id}">Kaydet</button>
      </div>
    `
    )
    .join("");

  el.emailHistory.innerHTML = db.emails
    .slice(0, 10)
    .map((m) => `<div class="item"><strong>${m.subject}</strong> -> ${m.to}</div>`)
    .join("");

  el.adminAnnouncements.innerHTML = db.announcements
    .map(
      (a) => `
      <div class="item">
        <strong>${a.title}</strong>
        <p>${a.content}</p>
        Slider: ${a.inAnnouncementSlider ? "Evet" : "Hayır"}<br />
        <button class="btn outline" data-toggle-ann-slider="${a.id}" data-current-ann-slider="${a.inAnnouncementSlider ? "1" : "0"}">
          ${a.inAnnouncementSlider ? "Sliderdan Kaldır" : "Sliderda Göster"}
        </button>
        <button class="btn danger" data-del-ann="${a.id}">Sil</button>
      </div>
    `
    )
    .join("");

  state.content.categories = db.categories;
  state.content.products = db.products;
  state.content.announcements = db.announcements;
  fillCategorySelect();
  renderAnnouncementSlider();
  renderDiscountSlider();
  bindAdminDynamicActions();
}

function getCategoryName(categoryId) {
  const category = adminStockCategories.find((c) => c.id === categoryId);
  return category ? trText(category.name) : "-";
}

function renderStockModalList(searchTerm = "") {
  if (!el.stockModalList) return;
  const term = searchTerm.trim().toLowerCase();
  const products = adminStockProducts.filter((p) => {
    if (!term) return true;
    const name = trText(p.name).toLowerCase();
    return name.includes(term) || String(p.id).toLowerCase().includes(term);
  });

  if (!products.length) {
    el.stockModalList.innerHTML = `<p class="hint" style="padding:12px;">Urun bulunamadi.</p>`;
    return;
  }

  el.stockModalList.innerHTML = `
    <table class="stock-table">
      <thead>
        <tr>
          <th>Urun</th>
          <th>Kategori</th>
          <th>Fiyat</th>
          <th>Stok</th>
          <th>Islem</th>
        </tr>
      </thead>
      <tbody>
        ${products
          .map((p) => {
            const stock = Number(p.stock) || 0;
            const stockClass = stock <= 5 ? "stock-low" : "stock-ok";
            return `
              <tr>
                <td><strong>${trText(p.name)}</strong></td>
                <td>${getCategoryName(p.categoryId)}</td>
                <td>${formatTl(p.price)}</td>
                <td>
                  <input type="number" min="0" value="${stock}" data-stock-input="${p.id}" />
                  <span class="${stockClass}">${stock <= 5 ? "Dusuk" : "Yeterli"}</span>
                </td>
                <td>
                  <div class="stock-actions">
                    <button class="btn outline" data-update-stock="${p.id}">Kaydet</button>
                  </div>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function bindAdminDynamicActions() {
  document.querySelectorAll("[data-del-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api(`/api/admin/users/${btn.dataset.delUser}`, { method: "DELETE" });
        toast("Kullanici silindi.");
        refreshAdminDashboard();
      } catch (error) {
        toast(error.message);
      }
    });
  });

  document.querySelectorAll("[data-del-product]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api(`/api/admin/products/${btn.dataset.delProduct}`, { method: "DELETE" });
        toast("Urun kaldirildi.");
        refreshAdminDashboard();
        loadCustomerContent();
      } catch (error) {
        toast(error.message);
      }
    });
  });

  document.querySelectorAll("[data-save-order]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const select = document.querySelector(`[data-order-status="${btn.dataset.saveOrder}"]`);
      try {
        await api(`/api/admin/orders/${btn.dataset.saveOrder}`, {
          method: "PUT",
          body: JSON.stringify({ status: select.value })
        });
        toast("Siparis durumu guncellendi.");
        refreshAdminDashboard();
      } catch (error) {
        toast(error.message);
      }
    });
  });

  document.querySelectorAll("[data-del-ann]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api(`/api/admin/announcements/${btn.dataset.delAnn}`, { method: "DELETE" });
        toast("Duyuru silindi.");
        refreshAdminDashboard();
        loadCustomerContent();
      } catch (error) {
        toast(error.message);
      }
    });
  });

  document.querySelectorAll("[data-toggle-ann-slider]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const current = btn.dataset.currentAnnSlider === "1";
      try {
        await api(`/api/admin/announcements/${btn.dataset.toggleAnnSlider}`, {
          method: "PUT",
          body: JSON.stringify({ inAnnouncementSlider: !current })
        });
        toast("Duyuru slider ayarı güncellendi.");
        refreshAdminDashboard();
        loadCustomerContent();
      } catch (error) {
        toast(error.message);
      }
    });
  });

  document.querySelectorAll("[data-clear-discount]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api(`/api/admin/products/${btn.dataset.clearDiscount}`, {
          method: "PUT",
          body: JSON.stringify({
            discountPrice: null,
            inDiscountSlider: false
          })
        });
        toast("İndirim kaldırıldı.");
        refreshAdminDashboard();
        loadCustomerContent();
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

document.querySelectorAll("[data-customer-tab]").forEach((button) => {
  button.addEventListener("click", () => switchCustomerTab(button.dataset.customerTab));
});

el.forumStarRating?.querySelectorAll(".star-btn").forEach((btn) => {
  btn.addEventListener("click", () => setForumRating(btn.dataset.star));
  btn.addEventListener("mouseenter", () => {
    const hoverValue = Number(btn.dataset.star);
    el.forumStarRating.querySelectorAll(".star-btn").forEach((starBtn) => {
      starBtn.classList.toggle("active", Number(starBtn.dataset.star) <= hoverValue);
    });
  });
});

el.forumStarRating?.addEventListener("mouseleave", () => {
  setForumRating(el.forumRatingInput.value || 0);
});

el.forumForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.user) {
    toast("Yorum yazmak icin giris yapin.");
    return;
  }

  const productId = el.forumProductSelect.value;
  const rating = Number(el.forumRatingInput.value);
  const comment = el.forumCommentInput.value.trim();

  if (!productId) {
    toast("Lutfen bir urun secin.");
    return;
  }
  if (rating < 1 || rating > 5) {
    toast("Lutfen 1 ile 5 arasinda puan verin.");
    return;
  }
  if (comment.length < 3) {
    toast("Yorum en az 3 karakter olmalidir.");
    return;
  }

  try {
    await api("/api/customer/forum", {
      method: "POST",
      body: JSON.stringify({ productId, rating, comment })
    });
    el.forumCommentInput.value = "";
    setForumRating(0);
    toast("Yorumunuz paylasildi.");
    await loadForum();
  } catch (error) {
    toast(error.message);
  }
});

el.paymentMethod.addEventListener("change", updatePaymentMethodUi);
el.cardHolder?.addEventListener("input", () => {
  el.cardHolder.value = normalizeCardHolderInput(el.cardHolder.value);
});
el.cardHolder?.addEventListener("keydown", blockNonLetterKey);
el.cardHolder?.addEventListener("paste", (event) => {
  event.preventDefault();
  const pasted = event.clipboardData?.getData("text") || "";
  el.cardHolder.value = normalizeCardHolderInput(el.cardHolder.value + pasted);
});
el.cardNumber.addEventListener("keydown", blockNonDigitKey);
el.cardNumber.addEventListener("input", () => {
  el.cardNumber.value = formatCardNumber(normalizeCardInput(el.cardNumber.value));
});
el.cardNumber.addEventListener("paste", (event) => {
  event.preventDefault();
  const pasted = event.clipboardData?.getData("text") || "";
  el.cardNumber.value = formatCardNumber(normalizeCardInput(el.cardNumber.value + pasted));
});
el.cardExpiry.addEventListener("keydown", blockNonDigitKey);
el.cardExpiry.addEventListener("input", () => {
  const digits = el.cardExpiry.value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) el.cardExpiry.value = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  else el.cardExpiry.value = digits;
});
el.cardExpiry.addEventListener("paste", (event) => {
  event.preventDefault();
  const pasted = (event.clipboardData?.getData("text") || "").replace(/\D/g, "");
  const digits = (el.cardExpiry.value.replace(/\D/g, "") + pasted).slice(0, 4);
  if (digits.length >= 3) el.cardExpiry.value = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  else el.cardExpiry.value = digits;
});
el.cardCvv.addEventListener("keydown", blockNonDigitKey);
el.cardCvv.addEventListener("input", () => {
  el.cardCvv.value = el.cardCvv.value.replace(/\D/g, "").slice(0, 3);
});
el.cardCvv.addEventListener("paste", (event) => {
  event.preventDefault();
  const pasted = (event.clipboardData?.getData("text") || "").replace(/\D/g, "");
  el.cardCvv.value = (el.cardCvv.value + pasted).replace(/\D/g, "").slice(0, 3);
});

document.getElementById("showLoginBtn").addEventListener("click", () => {
  document.getElementById("loginDialog").showModal();
});
document.getElementById("showRegisterBtn").addEventListener("click", () => {
  document.getElementById("registerDialog").showModal();
});
document.getElementById("closeLogin").addEventListener("click", () => {
  document.getElementById("loginDialog").close();
});
document.getElementById("closeRegister").addEventListener("click", () => {
  document.getElementById("registerDialog").close();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST" });
  } catch (_) {
    // no-op
  }
  state.token = "";
  state.user = null;
  localStorage.removeItem("oranjToken");
  localStorage.removeItem("oranjUser");
  updateAuthUi();
  el.adminPanel.classList.add("hidden");
  el.customerPanel.classList.remove("hidden");
  toast("Cikis yapildi.");
});

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  try {
    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password")
      })
    });
    state.token = result.token;
    state.user = result.user;
    localStorage.setItem("oranjToken", state.token);
    localStorage.setItem("oranjUser", JSON.stringify(state.user));
    updateAuthUi();
    document.getElementById("loginDialog").close();
    toast("Giris basarili.");
    const ordersData = await api("/api/customer/orders");
    renderCustomerOrders(ordersData.orders);
    await refreshAdminDashboard();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  try {
    await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        username: formData.get("username"),
        email: formData.get("email"),
        password: formData.get("password")
      })
    });
    document.getElementById("registerDialog").close();
    toast("Kayit olusturuldu, simdi giris yapabilirsiniz.");
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("paymentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.user) {
    toast("Siparis icin once giris yapin.");
    return;
  }
  if (!state.cart.length) {
    toast("Sepetiniz bos.");
    switchCustomerTab("cart");
    return;
  }
  try {
    const paymentPayload = validatePayment();
    const result = await api("/api/customer/orders", {
      method: "POST",
      body: JSON.stringify({
        items: state.cart,
        shippingAddress: paymentPayload.shippingAddress,
        invoiceAddress: paymentPayload.invoiceAddress,
        payment: paymentPayload.payment
      })
    });

    state.cart = [];
    persistCart();
    renderCart();
    renderQuickCart();
    el.lastOrderInfo.innerHTML = `
      <div class="item">
        <strong>Sipariş alındı.</strong><br />
        Sipariş No: ${result.order.orderNumber}<br />
        Takip Kodu: ${result.order.trackingCode}
      </div>
    `;
    toast(`Sipariş oluştu: ${result.order.orderNumber}`);

    const ordersData = await api("/api/customer/orders");
    renderCustomerOrders(ordersData.orders);
    if (state.user.role === "admin") await refreshAdminDashboard();
    await loadCustomerContent();
    switchCustomerTab("tracking");
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("trackOrderForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.user) {
    toast("Sipariş takibi için giriş yapın.");
    return;
  }
  const orderNo = el.orderSearchInput.value.trim();
  if (!orderNo) return;
  try {
    const result = await api(`/api/customer/track/${encodeURIComponent(orderNo)}`);
    showTrackingResult(result.order);
  } catch (error) {
    toast(error.message);
    el.trackingResult.innerHTML = "";
  }
});

function openStockModal() {
  el.stockSearchInput.value = "";
  renderStockModalList("");
  el.stockModalOverlay.classList.remove("hidden");
  el.stockModalOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeStockModal() {
  el.stockModalOverlay.classList.add("hidden");
  el.stockModalOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  el.stockModalList.innerHTML = "";
}

el.openStockModalBtn?.addEventListener("click", openStockModal);

el.closeStockDialog?.addEventListener("click", closeStockModal);

el.stockModalOverlay?.addEventListener("click", (event) => {
  if (event.target === el.stockModalOverlay) closeStockModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !el.stockModalOverlay?.classList.contains("hidden")) {
    closeStockModal();
  }
});

el.stockSearchInput?.addEventListener("input", (event) => {
  renderStockModalList(event.target.value);
});

el.stockModalList?.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-update-stock]");
  if (!btn) return;
  const input = el.stockModalList.querySelector(`[data-stock-input="${btn.dataset.updateStock}"]`);
  if (!input) return;
  try {
    await api(`/api/admin/products/${btn.dataset.updateStock}`, {
      method: "PUT",
      body: JSON.stringify({ stock: Number(input.value) })
    });
    toast("Stok guncellendi.");
    await refreshAdminDashboard();
    loadCustomerContent();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("adminTabButton").addEventListener("click", async () => {
  el.customerPanel.classList.add("hidden");
  el.adminPanel.classList.remove("hidden");
  await refreshAdminDashboard();
});

document.getElementById("backToCustomerBtn").addEventListener("click", () => {
  el.adminPanel.classList.add("hidden");
  el.customerPanel.classList.remove("hidden");
});

document.getElementById("addUserForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  try {
    await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        username: formData.get("username"),
        email: formData.get("email"),
        password: formData.get("password"),
        role: formData.get("role")
      })
    });
    event.target.reset();
    toast("Kullanici eklendi.");
    refreshAdminDashboard();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("addProductForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  try {
    await api("/api/admin/products", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        description: formData.get("description"),
        price: Number(formData.get("price")),
        stock: Number(formData.get("stock")),
        categoryId: formData.get("categoryId"),
        imageUrl: formData.get("imageUrl")
      })
    });
    event.target.reset();
    toast("Urun eklendi.");
    refreshAdminDashboard();
    loadCustomerContent();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("discountForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const productId = el.discountProductId.value;
  const newPrice = Number(el.discountNewPrice.value);
  const inSlider = el.discountInSlider.checked;
  const selectedProduct = state.content.products.find((p) => p.id === productId);
  const oldPrice = selectedProduct ? getOldPrice(selectedProduct) : 0;

  if (!productId) {
    toast("Ürün seçmelisiniz.");
    return;
  }
  if (!(oldPrice > 0) || !(newPrice > 0)) {
    toast("Fiyatlar sıfırdan büyük olmalı.");
    return;
  }
  if (newPrice >= oldPrice) {
    toast("Yeni fiyat eski fiyattan düşük olmalı.");
    return;
  }

  try {
    await api(`/api/admin/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify({
        oldPrice,
        price: oldPrice,
        discountPrice: newPrice,
        inDiscountSlider: inSlider
      })
    });
    toast(`İndirim kaydedildi. Oran: %${Math.round(((oldPrice - newPrice) / oldPrice) * 100)}`);
    event.target.reset();
    el.discountInSlider.checked = true;
    setDiscountOldPriceFromSelected();
    refreshAdminDashboard();
    loadCustomerContent();
  } catch (error) {
    toast(error.message);
  }
});

el.discountProductId.addEventListener("change", setDiscountOldPriceFromSelected);

document.getElementById("addCategoryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  try {
    await api("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify({ name: formData.get("name") })
    });
    event.target.reset();
    toast("Kategori eklendi.");
    refreshAdminDashboard();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("emailForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  try {
    await api("/api/admin/email", {
      method: "POST",
      body: JSON.stringify({
        to: formData.get("to"),
        subject: formData.get("subject"),
        message: formData.get("message")
      })
    });
    event.target.reset();
    toast("E-posta kaydi olusturuldu.");
    refreshAdminDashboard();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("announcementForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  try {
    await api("/api/admin/announcements", {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        content: formData.get("content")
      })
    });
    event.target.reset();
    toast("Duyuru eklendi.");
    refreshAdminDashboard();
    loadCustomerContent();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("accountForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  try {
    await api("/api/admin/account", {
      method: "PUT",
      body: JSON.stringify({
        username: formData.get("username") || undefined,
        email: formData.get("email") || undefined,
        password: formData.get("password") || undefined
      })
    });
    toast("Hesap bilgileri guncellendi.");
    refreshAdminDashboard();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("cmsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  try {
    await api("/api/admin/cms", {
      method: "PUT",
      body: JSON.stringify({
        siteTitle: formData.get("siteTitle") || undefined,
        heroTitle: formData.get("heroTitle") || undefined,
        heroSubtitle: formData.get("heroSubtitle") || undefined,
        primaryColor: formData.get("primaryColor") || undefined,
        accentColor: formData.get("accentColor") || undefined,
        bannerImage: formData.get("bannerImage") || undefined
      })
    });
    toast("CMS ayarlari guncellendi.");
    loadCustomerContent();
    refreshAdminDashboard();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("backToTopBox").addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

if (el.quickCartBtn) {
  el.quickCartBtn.addEventListener("click", () => {
    el.quickCartPanel.classList.toggle("hidden");
  });
}

if (el.closeProductSheetBtn) {
  el.closeProductSheetBtn.addEventListener("click", closeProductSheet);
}

document.getElementById("goPaymentBtn").addEventListener("click", () => {
  if (!state.cart.length) {
    toast("Sepetiniz bos.");
    return;
  }
  switchCustomerTab("payment");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.getElementById("backToCartBtn")?.addEventListener("click", () => {
  switchCustomerTab("cart");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.getElementById("clearCartBtn").addEventListener("click", () => {
  state.cart = [];
  persistCart();
  renderCart();
  renderQuickCart();
  toast("Sepet toplu olarak temizlendi.");
});

async function init() {
  await loadCustomerContent();
  updatePaymentMethodUi();
  updateAuthUi();
  if (el.productSearchInput) {
    el.productSearchInput.addEventListener("input", (event) => {
      state.productSearchTerm = event.target.value || "";
      renderProducts();
    });
  }
  const initialTab = new URLSearchParams(window.location.search).get("tab");
  if (["products", "cart", "tracking", "announcements", "forum"].includes(initialTab)) {
    switchCustomerTab(initialTab);
  }
  if (state.user) {
    try {
      const ordersData = await api("/api/customer/orders");
      renderCustomerOrders(ordersData.orders);
    } catch (_) {
      state.token = "";
      state.user = null;
      localStorage.removeItem("oranjToken");
      localStorage.removeItem("oranjUser");
      updateAuthUi();
    }
  }
}

init();
