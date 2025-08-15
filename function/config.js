// src/config.js

/**
 * Hàm kiểm tra xem người dùng có đang ở trên thiết bị di động hay không.
 * Nó kiểm tra dựa trên user agent và kích thước màn hình.
 * @returns {boolean} True nếu là thiết bị di động.
 */
const isMobile = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  // Regex để kiểm tra các chuỗi phổ biến trong user agent của mobile
  if (/android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())) {
    return true;
  }
  // Kiểm tra thêm dựa trên kích thước màn hình, hữu ích cho các thiết bị lai
  if (window.innerWidth <= 800 && window.innerHeight <= 600) {
    return true;
  }
  return false;
};

// --- Cấu hình chung cho cả hai nền tảng ---
const baseConfig = {
  fadeRadius: 5.0,
  fadeOpacity: 0.05,
  fadeDuration: 0.75,
  atlasTileSize: 256,
  fishCount: 2,
};

// --- Cấu hình riêng cho MÁY TÍNH (Desktop) ---
const desktopConfig = {
  ...baseConfig,
  devicePixelRatio: Math.min(window.devicePixelRatio, 2),
  cameraImageOffset: 0.4, // Gần hơn trên desktop
  galaxy: {
    coreInstanceCount: 30000,
    dustInstanceCount: 15000,
    haloInstanceCount: 10000,
    mixedArmsInstanceCount: 25000,
    coreParticle_size: 0.04,
    dustParticle_size: 0.02,
    haloParticle_size: 0.015,
    fishTrailCount: 500,
  },
  backgroundStars: {
    count: 10000,
    size: 0.08,
  },
  // Thêm các thông số khác dành riêng cho desktop ở đây
};

// --- Cấu hình riêng cho DI ĐỘNG (Mobile) ---
const mobileConfig = {
  ...baseConfig,
  devicePixelRatio: Math.min(window.devicePixelRatio, 1.5),
  highResTextureSize: 2048, // Giữ nguyên 1024 để đảm bảo chất lượng
  cameraImageOffset: .45, // Xa hơn để dễ nhìn trên mobile
  galaxy: {
    // Giảm số lượng hạt để tăng hiệu năng trên di động
    coreInstanceCount: 5000, 
    dustInstanceCount: 7000,
    haloInstanceCount: 5000,
    mixedArmsInstanceCount: 12000,
    coreParticle_size: 0.06,
    dustParticle_size: 0.08,
    haloParticle_size: 0.06,
    fishTrailCount: 250,
  },
  backgroundStars: {
    count: 5000,
    size: 0.2, // Sao nhỏ hơn một chút
  },
  // Thêm các thông số khác dành riêng cho mobile ở đây
};

// --- Xuất ra cấu hình cuối cùng dựa trên loại thiết bị ---
const config = isMobile() ? mobileConfig : desktopConfig;

export default config;