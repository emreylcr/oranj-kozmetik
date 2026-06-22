const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const sessions = new Map();

function id(prefix) {
  return `${prefix}-${crypto.randomBytes(5).toString("hex")}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1e7) {
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", reject);
  });
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const bundledDb = path.join(__dirname, "data", "db.json");
    if (bundledDb !== DB_PATH && fs.existsSync(bundledDb)) {
      fs.copyFileSync(bundledDb, DB_PATH);
      return;
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(seedData(), null, 2), "utf8");
  }
}

function seedData() {
  const categories = [
    { id: "cat-hair-dye", name: "Saç Boyası" },
    { id: "cat-skin-care", name: "Cilt Bakımı" },
    { id: "cat-makeup", name: "Makyaj" }
  ];

  const hairDyeTypes = ["Kalıcı Krem Boya", "Amonyaksız Boya", "Bitkisel Doğal Boya"];
  const shadeNumbers = ["1.0", "2.0", "3.0", "4.0", "5.0", "6.0", "7.0", "8.0", "9.0", "10.0"];
  const products = [];
  let sequence = 1;
  hairDyeTypes.forEach((type, typeIndex) => {
    shadeNumbers.forEach((shade, shadeIndex) => {
      products.push({
        id: `prd-${sequence}`,
        name: `Oranj ${type} ${shade}`,
        description: `${shade} tonunda yüksek kapatıcılık sağlayan profesyonel saç boyası.`,
        price: 165 + typeIndex * 18 + shadeIndex * 6,
        oldPrice: 165 + typeIndex * 18 + shadeIndex * 6,
        discountPrice: null,
        inDiscountSlider: false,
        stock: 14 + ((typeIndex + shadeIndex) % 20),
        categoryId: "cat-hair-dye",
        variants: [
          { code: shade, volume: "50 ml" },
          { code: shade, volume: "100 ml" }
        ],
        imageUrl: `https://picsum.photos/seed/oranj-${typeIndex}-${shadeIndex}/700/500`
      });
      sequence += 1;
    });
  });

  return {
    users: [
      {
        id: "usr-admin",
        username: "admin",
        password: "admin123",
        email: "admin@oranjkozmetik.com",
        role: "admin",
        createdAt: new Date().toISOString()
      },
      {
        id: "usr-customer-1",
        username: "melis",
        password: "123456",
        email: "melis@example.com",
        role: "customer",
        createdAt: new Date().toISOString()
      }
    ],
    categories,
    products,
    announcements: [
      {
        id: "ann-1",
        title: "Yeni Sezon Renkleri",
        content: "Yaz sezonu için yeni canlı saç boyası renkleri stoklara eklendi.",
        inAnnouncementSlider: true,
        createdAt: new Date().toISOString()
      }
    ],
    orders: [],
    emails: [],
    forumPosts: [],
    contactMessages: [],
    cmsSettings: {
      siteTitle: "Oranj Kozmetik",
      heroTitle: "Güzelliğini Renklendir",
      heroSubtitle: "Profesyonel kozmetik ürünleri ile güvenli alışveriş deneyimi.",
      primaryColor: "#be185d",
      accentColor: "#fb7185",
      bannerImage: "https://picsum.photos/seed/oranj-banner/1200/400",
      siteUrl: "https://oranj-kozmetik.onrender.com",
      seoTitle: "Oranj Kozmetik | Saç Boyası ve Kozmetik Ürünleri Online Alışveriş",
      seoDescription:
        "Oranj Kozmetik ile profesyonel saç boyası, cilt bakımı ve makyaj ürünlerini güvenle sipariş edin. Oranj Kozmetik online mağazasında uygun fiyat ve hızlı kargo.",
      seoKeywords: "oranj kozmetik, Oranj Kozmetik, saç boyası, kozmetik, online kozmetik, krem boya",
      contactInfo: {
        email: "info@oranjkozmetik.com",
        phone: "02126744846",
        phoneDisplay: "0212 674 48 46",
        address: "Fevzipaşa Mahallesi Söğüt Caddesi, No:36 İstanbul, 34586 Silivri",
        mapsUrl:
          "https://www.google.com/maps/search/?api=1&query=Fevzipaşa+Mahallesi+Söğüt+Caddesi+No+36+Silivri+İstanbul"
      },
      updatedAt: new Date().toISOString()
    }
  };
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  if (!Array.isArray(db.forumPosts)) db.forumPosts = [];
  if (!Array.isArray(db.contactMessages)) db.contactMessages = [];
  if (!db.cmsSettings.contactInfo) {
    db.cmsSettings.contactInfo = getContactInfo(db.cmsSettings);
  }
  syncCancelledOrderStock(db);
  return db;
}

function getContactInfo(settings = {}) {
  const defaults = {
    email: "info@oranjkozmetik.com",
    phone: "02126744846",
    phoneDisplay: "0212 674 48 46",
    address: "Fevzipaşa Mahallesi Söğüt Caddesi, No:36 İstanbul, 34586 Silivri",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Fevzipaşa+Mahallesi+Söğüt+Caddesi+No+36+Silivri+İstanbul"
  };
  return { ...defaults, ...(settings.contactInfo || {}) };
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function restoreOrderStock(db, order) {
  if (order.stockRestored) return;
  for (const item of order.items || []) {
    const product = db.products.find((p) => p.id === item.productId);
    if (product) product.stock += Number(item.quantity) || 0;
  }
  order.stockRestored = true;
}

function deductOrderStock(db, order) {
  if (!order.stockRestored) return;
  for (const item of order.items || []) {
    const product = db.products.find((p) => p.id === item.productId);
    if (!product) continue;
    const qty = Number(item.quantity) || 0;
    if (product.stock < qty) {
      throw new Error(`${product.name} icin yeterli stok yok.`);
    }
    product.stock -= qty;
  }
  order.stockRestored = false;
}

function syncCancelledOrderStock(db) {
  let changed = false;
  for (const order of db.orders || []) {
    if (order.stockRestored === undefined) {
      order.stockRestored = false;
      changed = true;
    }
    if (order.status === "Iptal" && !order.stockRestored) {
      restoreOrderStock(db, order);
      changed = true;
    }
  }
  if (changed) saveDb(db);
}

function getAuth(req) {
  const token = req.headers.authorization?.replace("Bearer ", "").trim();
  if (!token) return null;
  return sessions.get(token) || null;
}

function requireAuth(req, res) {
  const auth = getAuth(req);
  if (!auth) {
    writeJson(res, 401, { error: "Oturum gecersiz." });
    return null;
  }
  return auth;
}

function requireAdmin(req, res) {
  const auth = requireAuth(req, res);
  if (!auth) return null;
  if (auth.role !== "admin") {
    writeJson(res, 403, { error: "Admin yetkisi gerekli." });
    return null;
  }
  return auth;
}

function getPurchasedProductsForUser(db, userId) {
  const productMap = new Map();
  db.orders
    .filter((order) => order.customerId === userId)
    .forEach((order) => {
      (order.items || []).forEach((item) => {
        if (!item.productId) return;
        const product = db.products.find((p) => p.id === item.productId);
        productMap.set(item.productId, {
          id: item.productId,
          name: product?.name || item.name || item.productId
        });
      });
    });
  return Array.from(productMap.values()).sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

function sanitizeForumPosts(posts) {
  return posts
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((post) => ({
      id: post.id,
      username: post.username,
      productId: post.productId,
      productName: post.productName,
      rating: Number(post.rating),
      comment: post.comment,
      createdAt: post.createdAt
    }));
}

function sanitizeCustomerView(db) {
  const normalizedProducts = db.products.map((product) => {
    const oldPrice = Number(product.oldPrice ?? product.price);
    const discountPrice = product.discountPrice === null || product.discountPrice === undefined
      ? null
      : Number(product.discountPrice);
    return {
      ...product,
      oldPrice,
      discountPrice,
      inDiscountSlider: Boolean(product.inDiscountSlider)
    };
  });
  return {
    products: normalizedProducts,
    categories: db.categories,
    announcements: db.announcements.map((a) => ({
      ...a,
      inAnnouncementSlider: Boolean(a.inAnnouncementSlider ?? true)
    })),
    cmsSettings: db.cmsSettings,
    contactInfo: getContactInfo(db.cmsSettings)
  };
}

function getEffectivePrice(product) {
  const oldPrice = Number(product.oldPrice ?? product.price);
  const discountPrice = product.discountPrice === null || product.discountPrice === undefined
    ? null
    : Number(product.discountPrice);
  if (discountPrice && discountPrice > 0 && discountPrice < oldPrice) {
    return discountPrice;
  }
  return Number(product.price);
}

function generateOrderNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `SIP-${datePart}-${randomPart}`;
}

function validatePaymentPayload(payment) {
  const method = payment?.method;
  const allowedMethods = ["kapida_odeme", "banka_karti", "kredi_karti"];
  if (!allowedMethods.includes(method)) {
    return { ok: false, error: "Odeme yontemi gecersiz." };
  }

  if (method === "banka_karti" || method === "kredi_karti") {
    const cardHolder = String(payment.cardHolder || "")
      .replace(/[0-9]/g, "")
      .replace(/[^\p{L}\s]/gu, "")
      .trim();
    const cardNumber = String(payment.cardNumber || "").replace(/\D/g, "");
    const expiry = String(payment.expiry || "").trim();
    const cvv = String(payment.cvv || "").trim();
    if (cardHolder.length < 5 || !/^[\p{L}\s]+$/u.test(cardHolder)) {
      return { ok: false, error: "Kart sahibi adi sadece harf icermelidir." };
    }
    if (!/^\d{16}$/.test(cardNumber)) return { ok: false, error: "Kart numarasi 16 haneli olmali." };
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return { ok: false, error: "SKT formati AA/YY olmali." };
    if (!/^\d{3}$/.test(cvv)) return { ok: false, error: "CVV 3 haneli olmali." };
    const [mmText, yyText] = expiry.split("/");
    const month = Number(mmText);
    const year = 2000 + Number(yyText);
    if (month < 1 || month > 12) return { ok: false, error: "SKT ay bilgisi gecersiz." };
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return { ok: false, error: "Gecmis tarihli kart kabul edilmez." };
    }
    return {
      ok: true,
      paymentInfo: {
        method,
        cardHolder,
        maskedCardNumber: `**** **** **** ${cardNumber.slice(-4)}`,
        expiry
      }
    };
  }

  return { ok: true, paymentInfo: { method } };
}

function serveStatic(req, res) {
  const targetPath = req.url === "/" ? "/index.html" : req.url;
  const normalized = path.normalize(targetPath).replace(/^(\.\.[\\/])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) {
    writeJson(res, 404, { error: "Dosya bulunamadi." });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".webp": "image/webp"
  };
  res.writeHead(200, { "Content-Type": contentTypes[ext] || "text/plain; charset=utf-8" });
  fs.createReadStream(filePath).pipe(res);
}

function getSiteBaseUrl(req) {
  const envUrl = process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const host = req.headers.host || "oranj-kozmetik.onrender.com";
  return `https://${host}`;
}

function serveSitemap(req, res) {
  const db = readDb();
  const base = getSiteBaseUrl(req);
  const urls = [
    { loc: `${base}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${base}/index.html`, changefreq: "daily", priority: "0.9" }
  ];
  for (const product of db.products.slice(0, 200)) {
    urls.push({
      loc: `${base}/product.html?id=${encodeURIComponent(product.id)}`,
      changefreq: "weekly",
      priority: "0.8"
    });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (item) => `  <url>
    <loc>${item.loc}</loc>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;
  res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
  res.end(xml);
}

async function handleApi(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  if (req.method === "POST" && pathname === "/api/login") {
    const body = await readBody(req);
    const db = readDb();
    const user = db.users.find(
      (item) => item.username === body.username && item.password === body.password
    );
    if (!user) return writeJson(res, 401, { error: "Kullanici adi veya sifre hatali." });
    const token = crypto.randomBytes(20).toString("hex");
    sessions.set(token, { userId: user.id, username: user.username, role: user.role });
    return writeJson(res, 200, { token, user: { id: user.id, username: user.username, role: user.role } });
  }

  if (req.method === "POST" && pathname === "/api/register") {
    const body = await readBody(req);
    if (!body.username || !body.password || !body.email) {
      return writeJson(res, 400, { error: "Kullanici adi, sifre ve e-posta zorunludur." });
    }
    const db = readDb();
    if (db.users.some((u) => u.username === body.username)) {
      return writeJson(res, 409, { error: "Bu kullanici adi zaten var." });
    }
    const user = {
      id: id("usr"),
      username: body.username,
      password: body.password,
      email: body.email,
      role: "customer",
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    saveDb(db);
    return writeJson(res, 201, { message: "Kayit tamamlandi." });
  }

  if (req.method === "GET" && pathname === "/api/customer/content") {
    const db = readDb();
    return writeJson(res, 200, sanitizeCustomerView(db));
  }

  if (req.method === "GET" && pathname.startsWith("/api/customer/products/")) {
    const productId = decodeURIComponent(pathname.split("/").pop() || "").trim();
    const db = readDb();
    const payload = sanitizeCustomerView(db);
    const product = payload.products.find((p) => p.id === productId);
    if (!product) return writeJson(res, 404, { error: "Ürün bulunamadı." });
    return writeJson(res, 200, { product });
  }

  if (req.method === "POST" && pathname === "/api/customer/orders") {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const body = await readBody(req);
    const db = readDb();

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return writeJson(res, 400, { error: "Sepet bos olamaz." });
    }
    if (!body.shippingAddress || !String(body.shippingAddress).trim()) {
      return writeJson(res, 400, { error: "Teslimat adresi zorunludur." });
    }
    if (!body.invoiceAddress || !String(body.invoiceAddress).trim()) {
      return writeJson(res, 400, { error: "Fatura adresi zorunludur." });
    }
    const paymentValidation = validatePaymentPayload(body.payment);
    if (!paymentValidation.ok) {
      return writeJson(res, 400, { error: paymentValidation.error });
    }

    let totalPrice = 0;
    const validatedItems = [];
    for (const item of body.items) {
      const product = db.products.find((p) => p.id === item.productId);
      if (!product) return writeJson(res, 400, { error: "Gecersiz urun bulundu." });
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) return writeJson(res, 400, { error: "Urun miktari gecersiz." });
      if (product.stock < qty) {
        return writeJson(res, 400, { error: `${product.name} icin yeterli stok yok.` });
      }
      product.stock -= qty;
      const unitPrice = getEffectivePrice(product);
      const itemTotal = qty * unitPrice;
      totalPrice += itemTotal;
      validatedItems.push({ productId: product.id, name: product.name, quantity: qty, unitPrice });
    }

    const order = {
      id: id("ord"),
      orderNumber: generateOrderNumber(),
      customerId: auth.userId,
      customerUsername: auth.username,
      items: validatedItems,
      totalPrice,
      shippingAddress: String(body.shippingAddress).trim(),
      invoiceAddress: String(body.invoiceAddress).trim(),
      payment: paymentValidation.paymentInfo,
      status: "Hazirlaniyor",
      stockRestored: false,
      trackingCode: `TRK${Date.now().toString().slice(-8)}`,
      createdAt: new Date().toISOString()
    };
    db.orders.unshift(order);
    saveDb(db);
    return writeJson(res, 201, { message: "Siparis olusturuldu.", order });
  }

  if (req.method === "GET" && pathname === "/api/customer/orders") {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const db = readDb();
    const orders = db.orders.filter((o) => o.customerId === auth.userId);
    return writeJson(res, 200, { orders });
  }

  if (req.method === "GET" && pathname === "/api/customer/forum") {
    const db = readDb();
    return writeJson(res, 200, { posts: sanitizeForumPosts(db.forumPosts) });
  }

  if (req.method === "GET" && pathname === "/api/customer/forum/purchased-products") {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const db = readDb();
    return writeJson(res, 200, { products: getPurchasedProductsForUser(db, auth.userId) });
  }

  if (req.method === "POST" && pathname === "/api/customer/forum") {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const body = await readBody(req);
    const db = readDb();

    const productId = String(body.productId || "").trim();
    const comment = String(body.comment || "").trim();
    const rating = Number(body.rating);

    if (!productId) return writeJson(res, 400, { error: "Urun secimi zorunludur." });
    if (!comment || comment.length < 3) {
      return writeJson(res, 400, { error: "Yorum en az 3 karakter olmalidir." });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return writeJson(res, 400, { error: "Puan 1 ile 5 arasinda olmalidir." });
    }

    const purchased = getPurchasedProductsForUser(db, auth.userId);
    const purchasedProduct = purchased.find((p) => p.id === productId);
    if (!purchasedProduct) {
      return writeJson(res, 403, { error: "Yorum yazmak icin once bu urunu satin almis olmalisiniz." });
    }

    const post = {
      id: id("frm"),
      userId: auth.userId,
      username: auth.username,
      productId,
      productName: purchasedProduct.name,
      rating,
      comment,
      createdAt: new Date().toISOString()
    };
    db.forumPosts.unshift(post);
    saveDb(db);
    return writeJson(res, 201, { message: "Yorum paylasildi.", post });
  }

  if (req.method === "POST" && pathname === "/api/customer/contact") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (!name || name.length < 2) return writeJson(res, 400, { error: "Ad soyad gerekli." });
    if (!email || !email.includes("@")) return writeJson(res, 400, { error: "Gecerli e-posta gerekli." });
    if (!subject || subject.length < 3) return writeJson(res, 400, { error: "Konu en az 3 karakter olmali." });
    if (!message || message.length < 10) return writeJson(res, 400, { error: "Mesaj en az 10 karakter olmali." });

    const db = readDb();
    const contactInfo = getContactInfo(db.cmsSettings);
    db.contactMessages.unshift({
      id: id("cnt"),
      name,
      email,
      subject,
      message,
      createdAt: new Date().toISOString(),
      status: "yeni"
    });
    db.emails.unshift({
      id: id("mail"),
      to: contactInfo.email,
      from: email,
      fromName: name,
      subject: `[Iletisim] ${subject}`,
      message,
      sentAt: new Date().toISOString(),
      sentBy: name,
      type: "contact"
    });
    saveDb(db);
    return writeJson(res, 201, { message: "Mesajiniz alindi. En kisa surede size donus yapacagiz." });
  }

  if (req.method === "GET" && pathname.startsWith("/api/customer/track/")) {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const orderNo = decodeURIComponent(pathname.split("/").pop() || "").trim();
    const db = readDb();
    const order = db.orders.find(
      (o) =>
        o.customerId === auth.userId &&
        (o.orderNumber === orderNo || o.id === orderNo || o.trackingCode === orderNo)
    );
    if (!order) return writeJson(res, 404, { error: "Siparis bulunamadi." });
    return writeJson(res, 200, { order });
  }

  if (req.method === "GET" && pathname === "/api/admin/dashboard") {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const db = readDb();
    return writeJson(res, 200, db);
  }

  if (req.method === "POST" && pathname === "/api/admin/users") {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const body = await readBody(req);
    if (!body.username || !body.password || !body.email || !body.role) {
      return writeJson(res, 400, { error: "Tum alanlar zorunludur." });
    }
    const db = readDb();
    if (db.users.some((u) => u.username === body.username)) {
      return writeJson(res, 409, { error: "Bu kullanici adi zaten mevcut." });
    }
    db.users.push({
      id: id("usr"),
      username: body.username,
      password: body.password,
      email: body.email,
      role: body.role === "admin" ? "admin" : "customer",
      createdAt: new Date().toISOString()
    });
    saveDb(db);
    return writeJson(res, 201, { message: "Kullanici eklendi." });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/admin/users/")) {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const userId = pathname.split("/").pop();
    const db = readDb();
    const target = db.users.find((u) => u.id === userId);
    if (!target) return writeJson(res, 404, { error: "Kullanici bulunamadi." });
    if (target.username === "admin") return writeJson(res, 400, { error: "Varsayilan admin silinemez." });
    db.users = db.users.filter((u) => u.id !== userId);
    saveDb(db);
    return writeJson(res, 200, { message: "Kullanici silindi." });
  }

  if (req.method === "POST" && pathname === "/api/admin/products") {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const body = await readBody(req);
    if (!body.name || !body.categoryId) {
      return writeJson(res, 400, { error: "Urun adi ve kategori zorunludur." });
    }
    const db = readDb();
    db.products.push({
      id: id("prd"),
      name: body.name,
      description: body.description || "",
      price: Number(body.price) || 0,
      oldPrice: Number(body.price) || 0,
      discountPrice: null,
      inDiscountSlider: false,
      stock: Number(body.stock) || 0,
      categoryId: body.categoryId,
      variants: body.variants || [],
      imageUrl: body.imageUrl || "https://picsum.photos/seed/new-product/700/500"
    });
    saveDb(db);
    return writeJson(res, 201, { message: "Urun eklendi." });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/admin/products/")) {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const productId = pathname.split("/").pop();
    const db = readDb();
    if (!db.products.some((item) => item.id === productId)) {
      return writeJson(res, 404, { error: "Urun bulunamadi." });
    }
    db.products = db.products.filter((item) => item.id !== productId);
    saveDb(db);
    return writeJson(res, 200, { message: "Urun kaldirildi." });
  }

  if (req.method === "PUT" && pathname.startsWith("/api/admin/products/")) {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const productId = pathname.split("/").pop();
    const body = await readBody(req);
    const db = readDb();
    const product = db.products.find((item) => item.id === productId);
    if (!product) return writeJson(res, 404, { error: "Urun bulunamadi." });
    if (body.stock !== undefined) product.stock = Number(body.stock);
    if (body.price !== undefined) {
      product.price = Number(body.price);
      if (!product.oldPrice || Number(product.oldPrice) <= 0) product.oldPrice = Number(body.price);
    }
    if (body.oldPrice !== undefined) product.oldPrice = Number(body.oldPrice);
    if (body.discountPrice !== undefined) {
      product.discountPrice = body.discountPrice === null ? null : Number(body.discountPrice);
    }
    if (body.inDiscountSlider !== undefined) {
      product.inDiscountSlider = Boolean(body.inDiscountSlider);
    }
    if (body.categoryId !== undefined) product.categoryId = body.categoryId;
    const oldPrice = Number(product.oldPrice ?? product.price);
    if (product.discountPrice !== null && Number(product.discountPrice) >= oldPrice) {
      return writeJson(res, 400, { error: "Indirimli fiyat eski fiyattan dusuk olmali." });
    }
    saveDb(db);
    return writeJson(res, 200, { message: "Urun guncellendi." });
  }

  if (req.method === "POST" && pathname === "/api/admin/categories") {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const body = await readBody(req);
    if (!body.name) return writeJson(res, 400, { error: "Kategori adi gerekli." });
    const db = readDb();
    db.categories.push({ id: id("cat"), name: body.name });
    saveDb(db);
    return writeJson(res, 201, { message: "Kategori eklendi." });
  }

  if (req.method === "PUT" && pathname.startsWith("/api/admin/orders/")) {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const orderId = pathname.split("/").pop();
    const body = await readBody(req);
    const db = readDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) return writeJson(res, 404, { error: "Siparis bulunamadi." });
    const newStatus = body.status || order.status;
    const oldStatus = order.status;
    if (newStatus === "Iptal" && oldStatus !== "Iptal") {
      restoreOrderStock(db, order);
    } else if (oldStatus === "Iptal" && newStatus !== "Iptal") {
      try {
        deductOrderStock(db, order);
      } catch (error) {
        return writeJson(res, 400, { error: error.message });
      }
    }
    order.status = newStatus;
    saveDb(db);
    return writeJson(res, 200, { message: "Siparis durumu guncellendi." });
  }

  if (req.method === "POST" && pathname === "/api/admin/announcements") {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const body = await readBody(req);
    if (!body.title || !body.content) {
      return writeJson(res, 400, { error: "Baslik ve icerik gerekli." });
    }
    const db = readDb();
    db.announcements.unshift({
      id: id("ann"),
      title: body.title,
      content: body.content,
      inAnnouncementSlider: false,
      createdAt: new Date().toISOString()
    });
    saveDb(db);
    return writeJson(res, 201, { message: "Duyuru eklendi." });
  }

  if (req.method === "PUT" && pathname.startsWith("/api/admin/announcements/")) {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const annId = pathname.split("/").pop();
    const body = await readBody(req);
    const db = readDb();
    const ann = db.announcements.find((a) => a.id === annId);
    if (!ann) return writeJson(res, 404, { error: "Duyuru bulunamadi." });
    if (body.title !== undefined) ann.title = body.title;
    if (body.content !== undefined) ann.content = body.content;
    if (body.inAnnouncementSlider !== undefined) {
      ann.inAnnouncementSlider = Boolean(body.inAnnouncementSlider);
    }
    saveDb(db);
    return writeJson(res, 200, { message: "Duyuru guncellendi." });
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/admin/announcements/")) {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const annId = pathname.split("/").pop();
    const db = readDb();
    db.announcements = db.announcements.filter((a) => a.id !== annId);
    saveDb(db);
    return writeJson(res, 200, { message: "Duyuru silindi." });
  }

  if (req.method === "POST" && pathname === "/api/admin/email") {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const body = await readBody(req);
    if (!body.to || !body.subject || !body.message) {
      return writeJson(res, 400, { error: "Alici, konu ve mesaj alanlari gerekli." });
    }
    const db = readDb();
    db.emails.unshift({
      id: id("mail"),
      to: body.to,
      subject: body.subject,
      message: body.message,
      sentAt: new Date().toISOString(),
      sentBy: auth.username
    });
    saveDb(db);
    return writeJson(res, 200, { message: "E-posta islemi kaydedildi." });
  }

  if (req.method === "PUT" && pathname === "/api/admin/account") {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const body = await readBody(req);
    const db = readDb();
    const user = db.users.find((u) => u.id === auth.userId);
    if (!user) return writeJson(res, 404, { error: "Kullanici bulunamadi." });
    if (body.username) user.username = body.username;
    if (body.password) user.password = body.password;
    if (body.email) user.email = body.email;
    saveDb(db);

    sessions.forEach((value, key) => {
      if (value.userId === user.id) {
        sessions.set(key, { ...value, username: user.username });
      }
    });

    return writeJson(res, 200, { message: "Hesap bilgileri guncellendi." });
  }

  if (req.method === "PUT" && pathname === "/api/admin/cms") {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const body = await readBody(req);
    const db = readDb();
    db.cmsSettings = {
      ...db.cmsSettings,
      siteTitle: body.siteTitle ?? db.cmsSettings.siteTitle,
      heroTitle: body.heroTitle ?? db.cmsSettings.heroTitle,
      heroSubtitle: body.heroSubtitle ?? db.cmsSettings.heroSubtitle,
      primaryColor: body.primaryColor ?? db.cmsSettings.primaryColor,
      accentColor: body.accentColor ?? db.cmsSettings.accentColor,
      bannerImage: body.bannerImage ?? db.cmsSettings.bannerImage,
      siteUrl: body.siteUrl ?? db.cmsSettings.siteUrl,
      seoTitle: body.seoTitle ?? db.cmsSettings.seoTitle,
      seoDescription: body.seoDescription ?? db.cmsSettings.seoDescription,
      seoKeywords: body.seoKeywords ?? db.cmsSettings.seoKeywords,
      updatedAt: new Date().toISOString()
    };
    saveDb(db);
    return writeJson(res, 200, { message: "CMS ayarlari guncellendi." });
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    const token = req.headers.authorization?.replace("Bearer ", "").trim();
    if (token) sessions.delete(token);
    return writeJson(res, 200, { message: "Cikis yapildi." });
  }

  return writeJson(res, 404, { error: "API endpoint bulunamadi." });
}

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && urlObj.pathname === "/health") {
      return writeJson(res, 200, { status: "ok" });
    }
    if (req.method === "GET" && urlObj.pathname === "/sitemap.xml") {
      return serveSitemap(req, res);
    }
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
    } else {
      serveStatic(req, res);
    }
  } catch (error) {
    writeJson(res, 500, { error: error.message || "Beklenmeyen bir hata olustu." });
  }
});

ensureDb();

server.listen(PORT, HOST, () => {
  console.log(`Oranj Kozmetik server calisiyor: http://${HOST}:${PORT}`);
  console.log("Varsayilan admin girisi: admin / admin123");
});
