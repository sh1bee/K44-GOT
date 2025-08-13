import * as THREE from "three";
import { createFish } from "./FishModule.js";
//import { createFish } from "./FishAlternative.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import fragment from "../shader/fragment.glsl";
import vertex from "../shader/vertex.glsl";
import GUI from "lil-gui";
import gsap from "gsap";
import allImageUrls from "../function/imageUrls.js";
import { createCircleTexture, generateBgStars } from "../function/bg.js";

const parameters = {
  stars: 10000, // Có thể tăng lên một chút
  size: 0.08,  // GIẢM kích thước đáng kể
  starColor: '#aab8c2' // Một màu trắng xám nhẹ, không phải trắng tinh
};


export default class Sketch {

  constructor(options) {
    this.fadeRadius = 5.0;      // Bán kính để làm mờ các ảnh xung quanh (đơn vị 3D)
    this.fadeOpacity = 0.05;     // Độ mờ mục tiêu (0.0 = trong suốt, 1.0 = rõ)
    this.fadeDuration = 0.75;   // Thời gian cho hiệu ứng mờ (tính bằng giây)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      70, // fov
      window.innerWidth / window.innerHeight,
      0.001,
      100
    );
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 50, 50); // Hướng sáng từ trên cao
    this.scene.add(directionalLight);
    this.atlasCanvas = document.createElement('canvas');
    this.atlasContext = this.atlasCanvas.getContext('2d');

    this.atlasTexture = new THREE.CanvasTexture(this.atlasCanvas);

    //this.atlasGridSize = new THREE.Vector2(12, 12); // Lưới 4x4 = 16 ô
    const imageCount = allImageUrls.length;
    const gridSize = Math.ceil(Math.sqrt(imageCount)); // Tìm cạnh của hình vuông nhỏ nhất chứa đủ ảnh
    this.atlasGridSize = new THREE.Vector2(gridSize, gridSize);
    this.atlasTileSize = 512; // Mỗi ô có kích thước ABCxABC pixels
    this.atlasCanvas.width = this.atlasGridSize.x * this.atlasTileSize;
    this.atlasCanvas.height = this.atlasGridSize.y * this.atlasTileSize;
    this.imageLoader = new THREE.ImageLoader();
    this.nextAtlasSlot = 0;
    this.imageSlots = new Array(this.atlasGridSize.x * this.atlasGridSize.y).fill(null);

    this.loadedImages = [];

    this.imageAspectRatios = [];

    // === BẮT ĐẦU THAY ĐỔI ===
    // 1. TẠO TRÌNH TẢI TEXTURE
    this.particleTexture = createCircleTexture();
    
    // === KẾT THÚC THAY ĐỔI ===

    this.bgStars = generateBgStars(this.scene, parameters);
    this.fishAnimators = [];
    createFish(this.scene, this.camera, {
        scale: 0.1,
        tiltAngle: 20,
        pathRadius: 15,
        colorHead: new THREE.Color("#0077ff"), // Xanh dương sáng
        colorTail: new THREE.Color("#ffaa00"), // Cam vàng
        yVariance: 3,
        pathRandomness: 2,
    }).then(animator => this.fishAnimators.push(animator));
    
    // Tạo con cá thứ hai - y chang con thứ nhất nhưng đường bơi ngẫu nhiên khác
    // createFish(this.scene, this.camera, {
    //     scale: 0.1,
    //     tiltAngle: 30,
    //     pathRadius: 12
    // }).then(animator => this.fishAnimators.push(animator));

    // Tạo con cá thứ hai - nhỏ hơn, màu khác, bơi nghiêng góc khác
    createFish(this.scene, this.camera, {
        scale: 0.1,
        tiltAngle: 70,
        pathRadius: 12,
        colorHead: new THREE.Color("#ff4444"), // Đỏ
        colorTail: new THREE.Color("#ffff77"), // Vàng chanh
        clickEffect: 'spin',
        yVariance: 1,
        pathRandomness: 1,
        spinType: 'pitch',
    }).then(animator => this.fishAnimators.push(animator));
    this.clock = new THREE.Clock();
    this.materials = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.container = options.dom;
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer = new THREE.WebGLRenderer({
      preserveDrawingBuffer: true,

    });
    // this.renderer.autoClear = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.atlasTexture.magFilter = THREE.NearestFilter;
    this.atlasTexture.minFilter = THREE.LinearFilter;
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.atlasTexture.anisotropy = maxAnisotropy;

    this.container.appendChild(this.renderer.domElement);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.point = new THREE.Vector3(0,0,0)

    

    // var frustumSize = 10;
    // var aspect = window.innerWidth / window.innerHeight;
    // this.camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, -1000, 1000 );
    this.camera.position.set(0, 2, 9);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.time = 0;
    // 1. Tham số để bạn tùy chỉnh khoảng cách từ camera đến ảnh
    this.cameraImageOffset = 1; // Giảm giá trị này để lại gần hơn, tăng để ra xa hơn.

    // 2. Biến trạng thái: Lưu trữ mesh ảnh mà camera đang theo dõi.
    // Nếu là `null`, camera sẽ không theo dõi gì cả.
    this.followingImage = null;

    // 3. Lắng nghe sự kiện khi người dùng bắt đầu tương tác với camera
    this.listenForUserControl();

    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(
      "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/js/libs/draco/"
    ); // use a full url path
    this.gltf = new GLTFLoader();
    this.gltf.setDRACOLoader(this.dracoLoader);

    this.isPlaying = true;

    // 1. ==========================================TẠO CẤU HÌNH CHO KHỐI CẦU ===========================================
    // --- LỚP 1: LÕI TINH VÂN TRUNG TÂM (SÁNG, NÓNG, ĐA SẮC) ---
    const coreOptions = {
      shape: 'sphere',                         // Hình dạng: Khối cầu.
      instance_count: 30000,                   // Số lượng hạt, tạo độ dày đặc cho lõi.
      min_radius: 1,                           // Bán kính nhỏ nhất của khối cầu.
      max_radius: 1.141,                       // Bán kính lớn nhất của khối cầu.

      particle_size: 0.03,                     // Kích thước cơ bản của mỗi hạt.
      particle_size_dispersion: 0.25,          // Độ phân tán kích thước, tạo sự đa dạng (hạt to, hạt nhỏ).

      rotation_speed: 0.015,                       // Tốc độ quay tổng thể của lớp này.
      color_rotation_speed: 0.5,               // Tốc độ xoay của màu, đặt là 0 để dừng lại
      rotation_dispersion: 0.02,               // Độ phân tán tốc độ quay, mỗi hạt quay nhanh/chậm một chút.

      amplitude: 0.01,                         // Biên độ của hiệu ứng nhiễu (noise), tạo cảm giác "sôi" nhẹ.
      opacity: 0.5,                            // Độ mờ đục tổng thể của lớp.

      colorMode: 0,                            // Chế độ màu (0: Dùng palette Tinh vân trong shader, 1: Dùng màu đơn sắc).

      // Các thông số xoắn không cần thiết cho lõi hình cầu.
      twist_speed: 0, // Các thông số xoắn không cần thiết cho lõi hình cầu.
      twist_frequency: 0,
      twist_amplitude: 0,
    };
    this.getMesh(coreOptions);
    

    // --- LỚP 2: CÁC NHÁNH XOẮN ỐC CHÍNH (SAO TRẺ, MÀU XANH SÁNG) ---
    // Commented out - replaced with mixed particle system that includes images
    /*
    const mainArmsOptions = {
      shape: 'spiral',                         // Hình dạng: Xoắn ốc.
      instance_count: 50000,                   // Số lượng hạt lớn cho các nhánh chính.
      min_radius: 1.5,                         // Bắt đầu từ rìa của lõi.
      max_radius: 6.0,                         // Vươn ra xa.
      
      particle_size: 0.025,
      particle_size_dispersion: 0.15,

      rotation_speed: 0.01,
      rotation_dispersion: 0.015,
      
      // Thông số xoắn để tạo hình cánh tay
      twist_speed: 0.05,                        // Tốc độ các cánh tay "cuốn" vào.
      twist_dispersion: 0.1,                   // Độ phân tán tốc độ cuốn (một số vùng cuốn nhanh hơn).
      twist_dispersion_frequency: 0.2,        // Tần số của vùng phân tán tốc độ.
      twist_frequency: 0.25,                   // Tần số của các nếp uốn trên cánh tay (càng cao càng nhiều nếp uốn).
      twist_amplitude: 0.45,                    // Biên độ của các nếp uốn (càng cao càng uốn lượn).

      amplitude: 0.1,                         // Biên độ gợn sóng (noise). GIẢM mạnh để mặt phẳng thiên hà bớt 'gập ghềnh' và phẳng hơn.
      offset: 0.2,                             // Độ lệch pha của noise, thay đổi để tạo hình thái khác.
      opacity: .75,

      colorMode: 1,                            // Dùng màu đơn sắc.
      color: "#859af8",                        // Màu xanh lam của các ngôi sao trẻ, nóng.
    };
    this.getMesh(mainArmsOptions);
    */

    // --- LỚP 3: CÁC VỆT BỤI TỐI (TẠO CHIỀU SÂU VÀ TƯƠNG PHẢN) ---
    const dustLanesOptions = {
      shape: 'spiral',
      instance_count: 15000,
      min_radius: 1.8,
      max_radius: 5.5,

      particle_size: 0.02,
      particle_size_dispersion: 0.1,

      rotation_speed: 0.08,
      rotation_dispersion: 0.05,

      // Xoắn mạnh hơn và khác biệt để tạo lớp xen kẽ
      twist_speed: 0.35,
      twist_dispersion: 0.3,
      twist_dispersion_frequency: 0.2,
      twist_frequency: 0.4,
      twist_amplitude: 0.6,

      amplitude: 0.05,                         // Biên độ gợn sóng. Cũng GIẢM để giữ cho lớp bụi phẳng.
      offset: 1.0,                             // Offset khác để không trùng hoàn toàn với nhánh chính.
      opacity: 0.15,

      colorMode: 1,
      color: "#2b344d",                        // Màu xanh đậm, tối mô phỏng bụi.
    };
    this.getMesh(dustLanesOptions);

    // --- LỚP 4: VẦNG HÀO QUANG BÊN NGOÀI (SAO GIÀ, MỜ, THƯA THỚT) ---
    // Lớp này là hình cầu nên không bị ảnh hưởng bởi thay đổi làm "dẹp"
    const haloOptions = {
      shape: 'sphere',
      instance_count: 10000,
      min_radius: 6.0,
      max_radius: 9.0,
      particle_size: 0.015,
      particle_size_dispersion: 0.1,
      rotation_speed: 0.05,
      rotation_dispersion: 0.01,
      amplitude: 0.01,
      opacity: 0.1,
      colorMode: 1,
      color: "#e3e3c8",
      twist_speed: 0,
      twist_frequency: 0,
      twist_amplitude: 0,
    };
    this.getMesh(haloOptions);


    this.textureLoader = new THREE.TextureLoader();

    // Load images into atlas
    this.loadImagesToAtlas();
    this.lastTime = 0; 


    // =============================================

    this.resize();
    this.setupResize();
    this.raycasterEvent();
    // this.addObjects();

    this.resize();
    this.raycasterEvent()
    requestAnimationFrame(this.render.bind(this)); 
  }
  moveCameraToRandomImage() {
    if (!this.imageParticleMeshes || this.imageParticleMeshes.length === 0) {
        return;
    }

    const randomIndex = Math.floor(Math.random() * this.imageParticleMeshes.length);
    const randomImageMesh = this.imageParticleMeshes[randomIndex];

    // KÍCH HOẠT CHẾ ĐỘ THEO DÕI
    this.followingImage = randomImageMesh;
    // === BẮT ĐẦU THAY ĐỔI ===
    // ÁP DỤNG HIỆU ỨNG MỜ XUNG QUANH
    this.applyProximityFade(randomImageMesh);
    // === KẾT THÚC THAY ĐỔI ===

    gsap.to(this.controls.target, {
        duration: 1.5,
        x: randomImageMesh.position.x,
        y: randomImageMesh.position.y,
        z: randomImageMesh.position.z,
        ease: "power2.inOut",
    });

  }
  listenForUserControl() {
    this.controls.addEventListener('start', () => {
        // 'start' event được kích hoạt khi người dùng bắt đầu kéo/zoom/xoay.
        // Đây chính là lúc chúng ta cần ngắt chế độ theo dõi.
        if (this.followingImage) {
            this.followingImage = null;
            this.restoreAllImageOpacities();
        }
    });
  }

  raycasterEvent(){
    let mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(100,100,100,100).rotateX(-Math.PI/2),
      new THREE.MeshBasicMaterial({color: 0xff0000,wireframe: true})
    )
    // mesh.rotation.x = -Math.PI/2
    // this.scene.add(mesh)


    let testmesh =  new THREE.Mesh(
      new THREE.SphereGeometry(0.1,20,20),
      new THREE.MeshBasicMaterial({color: 0xff0000,wireframe: true})
    )
      // this.scene.add(testmesh)


    /*
    window.addEventListener( 'pointermove', (event)=>{
      this.pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
      this.pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
      this.raycaster.setFromCamera( this.pointer, this.camera );
      const intersects = this.raycaster.intersectObjects([mesh] );

      if(intersects[0]){
        this.point = intersects[0].point
        console.log(this.pointer,intersects[0].point)
        testmesh.position.copy(intersects[0].point)
      }


    } );*/
  }
  
  settings() {
    let that = this;
    this.settings = {
      progress: 0,
    };
    this.gui = new GUI();
    this.gui.add(this.settings, "progress", 0, 1, 0.01);
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this));
  }

  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  // Load images into atlas texture
  loadImagesToAtlas() {
    const promises = allImageUrls.map((url, index) => {
      return new Promise((resolve) => {
        this.imageLoader.load(url, (image) => {
          const slotIndex = this.nextAtlasSlot++;
          if (slotIndex >= this.imageSlots.length) {
            console.warn('Atlas is full, cannot load more images');
            resolve();
            return;
          }

          // Calculate aspect ratio
          const aspectRatio = image.width / image.height;
          this.imageAspectRatios[slotIndex] = aspectRatio;

          // Calculate position in atlas
          const col = slotIndex % this.atlasGridSize.x;
          const row = Math.floor(slotIndex / this.atlasGridSize.x);
          const x = col * this.atlasTileSize;
          const y = row * this.atlasTileSize;

          // Draw image to atlas, maintaining aspect ratio
          this.drawImageToAtlas(image, x, y, this.atlasTileSize, this.atlasTileSize, aspectRatio);

          this.imageSlots[slotIndex] = {
            url: url,
            aspectRatio: aspectRatio,
            slotIndex: slotIndex
          };

          resolve();
        }, undefined, (error) => {
          console.error('Error loading image:', url, error);
          resolve();
        });
      });
    });

    Promise.all(promises).then(() => {
      // Update the atlas texture
      this.atlasTexture.needsUpdate = true;

      // Debug: Check if atlas has content by sampling a pixel
      const imageData = this.atlasContext.getImageData(0, 0, 1, 1);

      // Create the mixed particle system after images are loaded
      this.createMixedParticleSystem();

    });
  }

  drawImageToAtlas(image, x, y, width, height, aspectRatio) {
    const ctx = this.atlasContext;

    // --- CÁC THÔNG SỐ BẠN CÓ THỂ ĐIỀU CHỈNH ---
    const framePadding = 8;       // Độ rộng viền trắng ở 3 cạnh (trái, phải, trên)
    const captionHeight = 25;     // Chiều cao CỐ ĐỊNH cho vùng ghi chú ở dưới
    const frameColor = 'rgba(255, 255, 245, 1)';
    const shadowColor = 'rgba(0, 0, 0, 0.3)';
    // ---------------------------------------------

    // Xóa sạch ô trên atlas trước khi vẽ
    ctx.clearRect(x, y, width, height);

    // BƯỚC 1: TÍNH TOÁN KÍCH THƯỚC CỦA ẢNH ĐỂ VỪA VỚI Ô
    // Ta sẽ đảm bảo chiều dài nhất của ảnh không vượt quá kích thước của ô (trừ đi padding)
    const maxImageDimension = width - (framePadding * 2);
    let scaledImageWidth, scaledImageHeight;

    if (aspectRatio > 1) { // Ảnh rộng (landscape)
        scaledImageWidth = maxImageDimension;
        scaledImageHeight = maxImageDimension / aspectRatio;
    } else { // Ảnh cao (portrait) hoặc vuông
        scaledImageHeight = maxImageDimension;
        scaledImageWidth = maxImageDimension * aspectRatio;
    }

    // BƯỚC 2: TÍNH TOÁN KÍCH THƯỚC CỦA KHUNG DỰA TRÊN KÍCH THƯỚC ẢNH
    // Khung sẽ tự động co giãn để ôm vừa lấy ảnh và phần caption.
    const finalFrameWidth = scaledImageWidth + (framePadding * 2);
    const finalFrameHeight = scaledImageHeight + framePadding + captionHeight; // Padding trên + Ảnh + Vùng caption

    // BƯỚC 3: TÍNH TOÁN VỊ TRÍ ĐỂ CĂN GIỮA KHUNG TRONG Ô ATLAS
    const frameX = x + (width - finalFrameWidth) / 2;
    const frameY = y + (height - finalFrameHeight) / 2;

    // BƯỚC 4: VẼ MỌI THỨ
    // Vẽ bóng đổ (tùy chọn nhưng tạo chiều sâu)
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    // Vẽ khung Polaroid với kích thước đã được tính toán
    ctx.fillStyle = frameColor;
    ctx.fillRect(frameX, frameY, finalFrameWidth, finalFrameHeight);

    // Tắt bóng đổ để vẽ ảnh và chữ
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Vẽ ảnh vào bên trong khung, tại đúng vị trí
    ctx.drawImage(
        image,
        frameX + framePadding, // Cách lề trái của khung 1 khoảng padding
        frameY + framePadding, // Cách lề trên của khung 1 khoảng padding
        scaledImageWidth,
        scaledImageHeight
    );

    // Vẽ chữ vào vùng caption đã được chừa ra một cách hoàn hảo
    ctx.fillStyle = '#000';
    ctx.font = 'italic 18px "Courier New", monospace';
    ctx.textAlign = 'center';

    const captionText = 'Kỷ liệm...';
    // Tọa độ Y của chữ được tính từ đáy của khung đi lên
    const textYPosition = frameY + finalFrameHeight - (captionHeight / 2) + 2; // Căn giữa trong vùng caption, +2 để trông cân đối hơn

    ctx.fillText(
        captionText,
        frameX + finalFrameWidth / 2, // Căn giữa theo chiều ngang của khung
        textYPosition
    );
  }

  createMixedParticleSystem() {

    // Create a new layer that mixes regular particles with image particles
   const mixedArmsOptions = {
      shape: 'spiral',
      instance_count: 25000, // Reduced count since we're adding images
      min_radius: 2.0,
      max_radius: 6.0,
      particle_size: 0.03,
      particle_size_dispersion: 0.2,
      rotation_speed: 0.01,
      rotation_dispersion: 0.015,
      twist_speed: 0.05,
      twist_dispersion: 0.1,
      twist_dispersion_frequency: 0.2,
      twist_frequency: 0.25,
      twist_amplitude: 0.45,
      amplitude: 0.1,
      offset: 0.2,
      opacity: 0.85,
      colorMode: 1,
      color: "#a5b8ff",
      useImages: false, // Regular particles
    };

    this.getMesh(mixedArmsOptions);

    // Create image-based particles - one instance per image only
    const availableImages = this.imageSlots.filter(slot => slot !== null).length;
    const imageParticleCount = availableImages; // Exactly one instance per image

    const imageParticleOptions = {
     shape: 'spiral',
      instance_count: imageParticleCount,
      min_radius: 2.0,
      max_radius: 6.0,
      particle_size: .75, // Much larger size so users can see clearly
      particle_size_dispersion: 0.3,
      rotation_speed: 0.008,
      rotation_dispersion: 0.01,
      twist_speed: 0.04,
      twist_dispersion: 0.08,
      twist_dispersion_frequency: 0.15,
      twist_frequency: 0.2,
      twist_amplitude: 0.4,
      amplitude: 0.08,
      offset: 0.5,
      opacity: 0.9,
      useImages: true, // Image particles
      atlasTexture: this.atlasTexture,
      atlasGridSize: this.atlasGridSize,
      imageAspectRatios: this.imageAspectRatios,
    };

    this.getImageMesh(imageParticleOptions);
  }

  getMesh(opts) {
    const count = opts.instance_count;
    const geo = new THREE.InstancedBufferGeometry();
    const startergeo = new THREE.PlaneGeometry(1, 1);

    geo.setAttribute("position", startergeo.getAttribute("position"));
    geo.index = startergeo.index;

    const wpos = new Float32Array(3 * count);
    const randoms = new Float32Array(count);

    if (opts.shape === 'sphere') {
        for (let i = 0; i < count; i++) {
            const radius = Math.pow(Math.random(), 3) * (opts.max_radius - opts.min_radius) + opts.min_radius;
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            wpos.set([x, y, z], i * 3);
            randoms[i] = Math.pow(Math.random(), 3);
        }
    } else { // Logic for spiral
        for (let r = 0; r < count; r++) {
            // === THAY ĐỔI CHÍNH Ở ĐÂY ===
            // Giảm mạnh hệ số của 's' từ 0.2 xuống 0.02 để làm phẳng đĩa
            let i_rand = 0.05 * (2*Math.random()-1), s = 0.02 * (2*Math.random()-1), a = 0.05 * (2*Math.random()-1);
            // ============================
            let l = Math.pow(r / (count - 1), 0.5);
            let c = 2 * Math.PI * 0.618033 * r;
            let u = new THREE.Vector3(l*Math.cos(c)+i_rand, s, l*Math.sin(c)+a);
            u.multiplyScalar(opts.max_radius - opts.min_radius).add(u.clone().normalize().multiplyScalar(opts.min_radius));
            wpos.set([u.x, u.y, u.z], r * 3);
            randoms[r] = Math.pow(Math.random(), 3);
        }
    }

    geo.setAttribute("w_pos", new THREE.InstancedBufferAttribute(wpos, 3, false));
    geo.setAttribute('aRandom', new THREE.InstancedBufferAttribute(randoms, 1));
    geo.instanceCount = count;

    let material = new THREE.ShaderMaterial({
        uniforms: {
            _Time: { value: 0 },
            _MainTexture: { value: this.particleTexture },
            _Opacity: { value: opts.opacity },
            uColorMode: { value: opts.colorMode || 0 },
            _Color: { value: new THREE.Color(opts.color || "#ffffff") },
            _Size: { value: opts.particle_size },
            _SizeDispersion: { value: opts.particle_size_dispersion || 0.0 },
            _RotationSpeed: { value: opts.rotation_speed || 0.0 },
            _RotationDispersion: { value: opts.rotation_dispersion || 0.0 },
            _TwistSpeed: { value: opts.twist_speed || 0.0 },
            _TwistDispersion: { value: opts.twist_dispersion || 0.0 },
            _TwistDispersionFrequency: { value: opts.twist_dispersion_frequency || 0.0 },
            _TwistFrequency: { value: opts.twist_frequency || 0.0 },
            _TwistAmplitude: { value: opts.twist_amplitude || 0.0 },
            _NoiseAmplitude: { value: opts.amplitude || 0.0 },
            _NoiseOffset: { value: opts.offset || 0.0 },
            _ColorRotationSpeed: { value: opts.color_rotation_speed || 0.0 },
            uLowQuality: { value: 0.0 },
        },
        depthWrite: false,
        transparent: true,
        vertexShader: vertex,
        fragmentShader: fragment,
    });

    const points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    this.scene.add(points);
    this.materials.push(material);
 }

  getImageMesh(opts) {
    const count = opts.instance_count;
    
    // Generate positions for spiral particles - each image gets one position
    const validImageSlots = this.imageSlots.filter(slot => slot !== null);
    
    // Store references for animation
    this.imageParticleMeshes = [];
    this.imageParticleData = [];
    
    for (let r = 0; r < count; r++) {
      // Use the same spiral generation logic as mainArmsOptions
      let i_rand = 0.05 * (2*Math.random()-1), s = 0.02 * (2*Math.random()-1), a = 0.05 * (2*Math.random()-1);
      let l = Math.pow(r / (count - 1), 0.5);
      let c = 2 * Math.PI * 0.618033 * r;
      let u = new THREE.Vector3(l*Math.cos(c)+i_rand, s, l*Math.sin(c)+a);
      u.multiplyScalar(opts.max_radius - opts.min_radius).add(u.clone().normalize().multiplyScalar(opts.min_radius));
      
      const random = Math.pow(Math.random(), 3);
      const imageSlot = validImageSlots[r];
      
      // Create individual geometry and material for each image
      const geometry = new THREE.PlaneGeometry(1, 1);
      
      // Create material with specific image slot
      const material = new THREE.MeshBasicMaterial({
        map: this.atlasTexture,
        transparent: true,
        opacity: opts.opacity,
        side: THREE.DoubleSide,
      });
      
      // Adjust UV coordinates to show only the specific image from atlas
      const col = imageSlot.slotIndex % this.atlasGridSize.x;
      const row = Math.floor(imageSlot.slotIndex / this.atlasGridSize.x);
      
      const uvAttribute = geometry.getAttribute('uv');
      const uvArray = uvAttribute.array;
      
      // Calculate atlas UV bounds
      const uMin = col / this.atlasGridSize.x;
      const uMax = (col + 1) / this.atlasGridSize.x;
      // Flip V coordinate since canvas Y is top-to-bottom, but UV is bottom-to-top
      const vMin = 1.0 - (row + 1) / this.atlasGridSize.y;
      const vMax = 1.0 - row / this.atlasGridSize.y;
      
      // Map UVs to the specific atlas slot (corrected mapping)
      for (let i = 0; i < uvArray.length; i += 2) {
        const u = uvArray[i]; // 0 or 1
        const v = uvArray[i + 1]; // 0 or 1
        
        // Map from 0-1 to the specific atlas region
        uvArray[i] = uMin + u * (uMax - uMin);
        uvArray[i + 1] = vMin + v * (vMax - vMin);
      }
      uvAttribute.needsUpdate = true;
      
      // Create mesh
      const mesh = new THREE.Mesh(geometry, material);
      
      // Set initial position
      mesh.position.set(u.x, u.y, u.z);
      
      // Make image face outwards from galaxy center
      const direction = new THREE.Vector3(u.x, u.y, u.z).normalize();
      mesh.lookAt(mesh.position.clone().add(direction));
      
      // Apply size scaling based on aspect ratio
      const scale = opts.particle_size * (1.0 + opts.particle_size_dispersion * random);
      const aspectRatio = imageSlot.aspectRatio;
      
      if (aspectRatio > 1.0) {
        // Wide image
        mesh.scale.set(scale * aspectRatio * 0.8, scale, scale);
      } else {
        // Tall image  
        mesh.scale.set(scale, scale / aspectRatio * 0.8, scale);
      }
      
      // Store data for animation
      this.imageParticleData.push({
        random: random,
        aspectRatio: aspectRatio,
        instanceID: imageSlot.slotIndex,
        basePosition: new THREE.Vector3(u.x, u.y, u.z),
        mesh: mesh
      });
      
      this.imageParticleMeshes.push(mesh);
      this.scene.add(mesh);
      // Don't add MeshBasicMaterial to materials array since it doesn't have _Time uniform
    }
    
  }

  updateImageParticles(elapsedTime) {
    if (!this.imageParticleMeshes || !this.imageParticleData) return;

    const opts = {
      rotation_speed: 0.008,
      rotation_dispersion: 0.01,
      twist_speed: 0.04,
      twist_dispersion: 0.08,
      twist_dispersion_frequency: 0.15,
      twist_frequency: 0.2,
      twist_amplitude: 0.4,
      amplitude: 0.08,
      offset: 0.5,
      particle_size: .5, // Match the larger size
      particle_size_dispersion: 0.3,
    };

    for (let i = 0; i < this.imageParticleData.length; i++) {
      const data = this.imageParticleData[i];
      const mesh = data.mesh;
      let worldPos = data.basePosition.clone();
      
      // Apply spiral twist effect (same as in vertex shader)
      const radius = Math.sqrt(worldPos.x * worldPos.x + worldPos.z * worldPos.z);
      let angle = Math.atan2(worldPos.z, worldPos.x);
      
      // Twist animation
      const twistOffset = opts.twist_speed * elapsedTime + opts.twist_dispersion * data.random * Math.sin(opts.twist_dispersion_frequency * radius);
      angle -= twistOffset;
      
      // Apply twist frequency and amplitude
      const twistWave = Math.sin(opts.twist_frequency * radius + elapsedTime * opts.twist_speed) * opts.twist_amplitude;
      angle -= twistWave * data.random;
      
      // Recalculate position with twist
      worldPos.x = radius * Math.cos(angle);
      worldPos.z = radius * Math.sin(angle);
      
      // Add noise for organic movement
      const noisePos = worldPos.clone().multiplyScalar(0.5).addScalar(opts.offset);
      const noiseOffset = new THREE.Vector3(
        this.noise(noisePos.x + elapsedTime * 0.1, noisePos.y, noisePos.z),
        this.noise(noisePos.x, noisePos.y + elapsedTime * 0.1 + 100, noisePos.z),
        this.noise(noisePos.x, noisePos.y, noisePos.z + elapsedTime * 0.1 + 200)
      ).subScalar(0.5);
      worldPos.add(noiseOffset.multiplyScalar(opts.amplitude * data.random));
      
      // Apply rotation
      const rotationAngle = elapsedTime * opts.rotation_speed + data.random * opts.rotation_dispersion * elapsedTime;
      const cos = Math.cos(rotationAngle);
      const sin = Math.sin(rotationAngle);
      const newX = worldPos.x * cos - worldPos.z * sin;
      const newZ = worldPos.x * sin + worldPos.z * cos;
      worldPos.x = newX;
      worldPos.z = newZ;
      
      // Update mesh position
      mesh.position.copy(worldPos);
      
      // Make images face outwards from galaxy center
      const direction = worldPos.clone().normalize();
      mesh.lookAt(mesh.position.clone().add(direction));
      
      // Apply size scaling
      const scale = opts.particle_size * (1.0 + opts.particle_size_dispersion * data.random);
      const aspectRatio = data.aspectRatio;
      
      if (aspectRatio > 1.0) {
        mesh.scale.set(scale * aspectRatio * 0.8, scale, scale);
      } else {
        mesh.scale.set(scale, scale / aspectRatio * 0.8, scale);
      }
    }
  }

  // Simple noise function for animation
  noise(x, y = 0, z = 0) {
    return Math.sin(x * 12.9898 + y * 78.233 + z * 45.164) * 0.5 + 0.5;
  }
  
  // Method to reload images when allImageUrls is updated
  reloadImages() {
    
    // Clear existing atlas
    this.atlasContext.clearRect(0, 0, this.atlasCanvas.width, this.atlasCanvas.height);
    this.nextAtlasSlot = 0;
    this.imageSlots.fill(null);
    this.imageAspectRatios = [];
    
    // Remove existing image meshes
    if (this.imageParticleMeshes) {
      this.imageParticleMeshes.forEach(mesh => {
        this.scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
     });
      this.imageParticleMeshes = [];
      this.imageParticleData = [];
    }
    
    // Reload images
    this.loadImagesToAtlas();
  }

  applyProximityFade(targetMesh) {
    const targetPosition = targetMesh.position;

    this.imageParticleMeshes.forEach(mesh => {
      // Không áp dụng hiệu ứng cho chính ảnh đang được theo dõi
      if (mesh === targetMesh) {
        // Đảm bảo ảnh mục tiêu luôn rõ nét
        gsap.to(mesh.material, {
          opacity: 1.0,
          duration: this.fadeDuration
        });
        return; // Chuyển sang mesh tiếp theo
      }

      const distance = mesh.position.distanceTo(targetPosition);

      if (distance <= this.fadeRadius) {
        // Ảnh này nằm trong bán kính -> Làm mờ nó đi
        gsap.to(mesh.material, {
          opacity: this.fadeOpacity,
          duration: this.fadeDuration,
          ease: "power2.out"
        });
      } else {
        // Ảnh này nằm ngoài bán kính -> Đảm bảo nó rõ nét
        gsap.to(mesh.material, {
          opacity: 1.0, // Opacity gốc
          duration: this.fadeDuration,
          ease: "power2.out"
        });
      }
    });
  }

  /**
   * Khôi phục độ rõ nét cho tất cả các ảnh.
   */
  restoreAllImageOpacities() {
    this.imageParticleMeshes.forEach(mesh => {
      gsap.to(mesh.material, {
        opacity: 1.0, // Opacity gốc
        duration: this.fadeDuration,
        ease: "power2.inOut"
      });
    });
  }

  stop() {
    this.isPlaying = false;
  }

  play() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.render();
    }
  }

  // THAY THẾ TOÀN BỘ HÀM render() CŨ BẰNG HÀM NÀY

  render(time) {
    if (!this.isPlaying) return;

    // Khởi tạo lastTime ở lần chạy đầu tiên
    if (this.lastTime === 0) {
        this.lastTime = time * 0.001;
        requestAnimationFrame(this.render.bind(this));
        return; // Bỏ qua frame đầu tiên để có delta hợp lệ
    }

    time *= 0.001; 
    const delta = time - this.lastTime;
    this.lastTime = time;
    const elapsedTime = time;
    //-- Bắt đầu debug delta ---
    if (Math.random() < 0.1) {
         console.log("Manual Delta:", delta);
    }
    this.bgStars.rotation.y = -elapsedTime * 0.005;
    // === BẮT ĐẦU THAY ĐỔI: LOGIC CROSS-FADE LOD ===
    if (this.coreMesh && this.impostorMesh) {
        const distanceToCore = this.camera.position.length();

        // Định nghĩa các ngưỡng khoảng cách để chuyển đổi
        const startFadeDistance = 4.0; // Bắt đầu chuyển đổi
        const endFadeDistance = 2.5;   // Hoàn tất chuyển đổi

        // Tính tỉ lệ chuyển đổi (0.0 -> 1.0)
        // 0.0 = Hoàn toàn là hệ thống hạt (ở xa)
        // 1.0 = Hoàn toàn là impostor (ở gần)
        let fadeRatio = (startFadeDistance - distanceToCore) / (startFadeDistance - endFadeDistance);
        fadeRatio = THREE.MathUtils.clamp(fadeRatio, 0.0, 1.0);

        // Lấy opacity gốc của lõi từ options
        const originalCoreOpacity = 0.5; // Lấy từ coreOptions

        // Điều khiển opacity của cả hai đối tượng
        // 1. Hệ thống hạt: Mờ dần khi lại gần (từ opacity gốc -> 0)
        this.coreMaterial.uniforms._Opacity.value = originalCoreOpacity * (1.0 - fadeRatio);
        
        // 2. Impostor: Hiện dần khi lại gần (từ 0 -> 1.0)
        // Cần cập nhật cả uniform _Time cho impostor
        this.impostorMaterial.uniforms._Time.value = elapsedTime;
        this.impostorMaterial.uniforms._Opacity.value = fadeRatio;

        // Bật/tắt visibility để tối ưu hóa hoàn toàn
        // Chỉ render impostor khi nó có opacity > 0
        this.impostorMesh.visible = fadeRatio > 0.01;
        // Chỉ render hệ thống hạt khi nó có opacity > 0
        this.coreMesh.visible = fadeRatio < 0.99;
        
        // Luôn làm cho impostor hướng về phía camera (Billboard)
        if (this.impostorMesh.visible) {
            this.impostorMesh.lookAt(this.camera.position);
        }
    }
    this.updateImageParticles(elapsedTime);

    if (this.fishAnimators.length > 0) {
      this.fishAnimators.forEach(animator => {
        animator(delta);
      });
    }
    
    if (this.followingImage) {
        const targetMesh = this.followingImage;

        const targetPosition = new THREE.Vector3();
        targetMesh.getWorldPosition(targetPosition);

        // --- SỬA LỖI Ở ĐÂY ---
        // Cập nhật cả mục tiêu của OrbitControls để nó "khóa" vào ảnh
        this.controls.target.copy(targetPosition);
        // -----------------------

        const normal = new THREE.Vector3(0, 0, 1);
        normal.applyQuaternion(targetMesh.quaternion);

        const cameraDestination = targetPosition.clone().add(normal.multiplyScalar(this.cameraImageOffset));

        // Di chuyển camera mượt mà
        this.camera.position.lerp(cameraDestination, 0.05);

        // Dòng lookAt này giờ chỉ mang tính hỗ trợ, vì controls.target đã là nguồn chính
        this.camera.lookAt(targetPosition);
    }
    const distanceToCore = this.camera.position.length();
    const lowQuality = distanceToCore < 10 ? 1.0 : 0.0;
    this.materials.forEach(m => {
        if (m.uniforms && m.uniforms.uLowQuality) {
            m.uniforms.uLowQuality.value = lowQuality;
        }
        if (m.uniforms && m.uniforms._Time) {
            m.uniforms._Time.value = elapsedTime;
        }
    });

    // Cập nhật OrbitControls sau khi đã điều chỉnh camera và target
    this.controls.update();

    requestAnimationFrame(this.render.bind(this)); 
    this.renderer.render(this.scene, this.camera);
  }
}