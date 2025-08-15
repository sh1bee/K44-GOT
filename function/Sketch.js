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
import config from './config.js';

const parameters = {
  stars: config.backgroundStars.count, // Sử dụng config
  size: config.backgroundStars.size,    // Sử dụng config
  starColor: '#aab8c2'
};


export default class Sketch {

  constructor(options) {
    this.fadeRadius = config.fadeRadius;
    this.fadeOpacity = config.fadeOpacity;
    this.fadeDuration = config.fadeDuration;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      70, // fov
      window.innerWidth / window.innerHeight,
      0.001,
      100
    );
    this.textureLoader = new THREE.TextureLoader(); // Trình tải texture riêng
    this.textureCache = new Map(); // Cache để lưu các texture đã tải
    this.focusedImageData = null; // Lưu trữ dữ liệu của ảnh đang được focus
    // UV mặc định cho một PlaneGeometry (0 -> 1)
    this.defaultUVs = new Float32Array([
        0, 1, // top-left
        1, 1, // top-right
        0, 0, // bottom-left
        1, 0, // bottom-right
    ]);
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
    this.atlasTileSize = config.atlasTileSize;
    this.atlasCanvas.width = this.atlasGridSize.x * this.atlasTileSize;
    this.atlasCanvas.height = this.atlasGridSize.y * this.atlasTileSize;
    this.imageLoader = new THREE.ImageLoader();
    this.nextAtlasSlot = 0;
    this.imageSlots = new Array(this.atlasGridSize.x * this.atlasGridSize.y).fill(null);

    this.loadedImages = [];

    this.imageAspectRatios = [];
    this.imageHitboxes = [];
    this.isPanning = false;


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
        trailParticleCount: config.galaxy.fishTrailCount,
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
        trailParticleCount: config.galaxy.fishTrailCount,
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
    this.renderer.setPixelRatio(config.devicePixelRatio);
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
    this.cameraImageOffset = config.cameraImageOffset; 
    this.cameraCenteringOffset = new THREE.Vector3(0.02, 0, 0.005); 
    // 2. Biến trạng thái: Lưu trữ mesh ảnh mà camera đang theo dõi.
    // Nếu là `null`, camera sẽ không theo dõi gì cả.
    this.followingImage = null;
    this.currentImageIndex = -1;
    

    // 3. Lắng nghe sự kiện khi người dùng bắt đầu tương tác với camera

    this.pointerDownPosition = new THREE.Vector2(); // Biến mới để lưu vị trí nhấn chuột
    this.setupOrbitControlsListeners(); // Hàm mới xử lý sự kiện của OrbitControls
    this.setupPointerEvents();          // Hàm mới xử lý click/drag


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
      instance_count: config.galaxy.coreInstanceCount,                   // Số lượng hạt, tạo độ dày đặc cho lõi.
      min_radius: 1,                           // Bán kính nhỏ nhất của khối cầu.
      max_radius: 1.141,                       // Bán kính lớn nhất của khối cầu.

      particle_size: config.galaxy.coreParticle_size,                     // Kích thước cơ bản của mỗi hạt.
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
      instance_count: config.galaxy.dustInstanceCount,
      min_radius: 1.8,
      max_radius: 5.5,

      particle_size: config.galaxy.dustParticle_size,
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
      instance_count: config.galaxy.haloInstanceCount,
      min_radius: 6.0,
      max_radius: 9.0,
      particle_size: config.galaxy.haloParticle_size,
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

  setupOrbitControlsListeners() {
    this.controls.addEventListener('start', () => {
        // Logic này của bạn đã rất tốt và được giữ lại
        // Khi người dùng bắt đầu kéo, hủy theo dõi ảnh hiện tại
        if (this.followingImage) {
            this.followingImage = null;
            this.restoreAllImageOpacities();
            if (this.focusedImageData) {
                this.switchToLowRes(this.focusedImageData);
                this.focusedImageData = null;
            }
        }
    });
  }
  // Thêm hàm này vào class Sketch (và xóa các hàm cũ)
setupPointerEvents() {
    // Lắng nghe sự kiện trên chính canvas của renderer
    const domElement = this.renderer.domElement;

    domElement.addEventListener('pointerdown', (event) => {
        // 1. Ghi lại vị trí khi chuột được nhấn xuống
        this.pointerDownPosition.set(event.clientX, event.clientY);
    });

    domElement.addEventListener('pointerup', (event) => {
        // 2. Tính toán khoảng cách di chuyển
        const deltaX = Math.abs(event.clientX - this.pointerDownPosition.x);
        const deltaY = Math.abs(event.clientY - this.pointerDownPosition.y);
        
        // 3. Đặt một ngưỡng nhỏ (ví dụ: 5 pixel)
        const clickThreshold = 5;

        // 4. Nếu di chuyển ít hơn ngưỡng -> Coi đó là một cú CLICK
        if (deltaX < clickThreshold && deltaY < clickThreshold) {
            console.log("Phát hiện CLICK (di chuyển ít). Tiến hành raycast...");

            // --- Toàn bộ logic raycast được đặt vào đây ---
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);

            if (this.imageHitboxes && this.imageHitboxes.length > 0) {
                const intersects = this.raycaster.intersectObjects(this.imageHitboxes);
                
                if (intersects.length > 0) {
                    const clickedHitbox = intersects[0].object;
                    const clickedIndex = clickedHitbox.userData.imageIndex;
                    
                    if (clickedIndex !== undefined) {
                        console.log(`Raycaster trúng hitbox! Index: ${clickedIndex}`);
                        this.focusOnImageByIndex(clickedIndex);
                    }
                } else {
                     console.log("Click nhưng không trúng hitbox nào.");
                }
            }
        } else {
             console.log("Phát hiện DRAG (di chuyển nhiều). Bỏ qua raycast.");
        }
    });
}
  // <<< HÀM MỚI: Di chuyển camera đến một ảnh theo index >>>
  focusOnImageByIndex(index) {
    // Đảm bảo index nằm trong phạm vi hợp lệ
    const imageCount = this.imageParticleData.length;
    if (imageCount === 0) return; // Không có ảnh để focus

    // Logic "quay vòng" cho index
    const newIndex = (index + imageCount) % imageCount;

    // Nếu ảnh đang focus không thay đổi thì không làm gì
    if (newIndex === this.currentImageIndex) return;

    // Chuyển ảnh cũ về chất lượng thấp
    if (this.focusedImageData) {
        this.switchToLowRes(this.focusedImageData);
    }

    // Lấy dữ liệu ảnh mới
    const imageData = this.imageParticleData[newIndex];
    const imageMesh = imageData.mesh;
    
    // Cập nhật trạng thái
    this.switchToHighRes(imageData);
    this.focusedImageData = imageData;
    this.applyProximityFade(imageMesh);
    this.followingImage = imageMesh;
    this.currentImageIndex = newIndex; // Cập nhật index hiện tại
  }
  
  // Sửa đổi hàm moveCameraToRandomImage để sử dụng hàm mới
  moveCameraToRandomImage() {
    if (this.imageParticleData.length === 0) return;
    
    let randomIndex;
    // Đảm bảo không chọn lại ảnh hiện tại
    do {
        randomIndex = Math.floor(Math.random() * this.imageParticleData.length);
    } while (this.imageParticleData.length > 1 && randomIndex === this.currentImageIndex);

    this.focusOnImageByIndex(randomIndex);
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
  }// HÀM MỚI: Logic vẽ Polaroid cốt lõi
  drawPolaroid(ctx, image, destX, destY, destWidth, destHeight) {
    // --- CÁC THÔNG SỐ BẠN CÓ THỂ ĐIỀU CHỈNH ---
    const framePadding = 8;
    const captionHeight = 25;
    const frameColor = 'rgba(255, 255, 245, 1)';
    const shadowColor = 'rgba(0, 0, 0, 0.3)';
    // ---------------------------------------------

    ctx.clearRect(destX, destY, destWidth, destHeight);

    const aspectRatio = image.width / image.height;
    const maxImageDimension = destWidth - (framePadding * 2);
    let scaledImageWidth, scaledImageHeight;

    if (aspectRatio > 1) {
        scaledImageWidth = maxImageDimension;
        scaledImageHeight = maxImageDimension / aspectRatio;
    } else {
        scaledImageHeight = maxImageDimension;
        scaledImageWidth = maxImageDimension * aspectRatio;
    }

    const finalFrameWidth = scaledImageWidth + (framePadding * 2);
    const finalFrameHeight = scaledImageHeight + framePadding + captionHeight;
    const frameX = destX + (destWidth - finalFrameWidth) / 2;
    const frameY = destY + (destHeight - finalFrameHeight) / 2;

    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    
    ctx.fillStyle = frameColor;
    ctx.fillRect(frameX, frameY, finalFrameWidth, finalFrameHeight);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.drawImage(
        image,
        frameX + framePadding,
        frameY + framePadding,
        scaledImageWidth,
        scaledImageHeight
    );

    ctx.fillStyle = '#000';
    ctx.font = 'italic 18px "Courier New", monospace';
    ctx.textAlign = 'center';

    const captionText = 'Kỷ niệm...';
    const textYPosition = frameY + finalFrameHeight - (captionHeight / 2) + 2;

    ctx.fillText(
        captionText,
        frameX + finalFrameWidth / 2,
        textYPosition
    );
  }

  // HÀM CŨ ĐƯỢC CẬP NHẬT: Giờ nó chỉ gọi hàm mới
  drawImageToAtlas(image, x, y, width, height) {
      // Hàm này giờ chỉ là một trình bao bọc (wrapper) đơn giản
      this.drawPolaroid(this.atlasContext, image, x, y, width, height);
  }

  createMixedParticleSystem() {

    // Create a new layer that mixes regular particles with image particles
   const mixedArmsOptions = {
      shape: 'spiral',
      instance_count: config.galaxy.mixedArmsInstanceCount, // Reduced count since we're adding images
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
      
      // Lấy các slot ảnh hợp lệ
      const validImageSlots = this.imageSlots.filter(slot => slot !== null);
      
      // Khởi tạo lại các mảng (để đảm bảo sạch sẽ khi reload)
      this.imageParticleMeshes = [];
      this.imageParticleData = [];
      
      // Vòng lặp để tạo từng mesh ảnh và hitbox tương ứng
      for (let r = 0; r < count; r++) {
        // 1. TÍNH TOÁN VỊ TRÍ BAN ĐẦU TRONG THIÊN HÀ
        const random = Math.pow(Math.random(), 3);
        const i_rand = 0.05 * (2 * Math.random() - 1);
        const s = 0.02 * (2 * Math.random() - 1);
        const a = 0.05 * (2 * Math.random() - 1);
        const l = Math.pow(r / (count - 1), 0.5);
        const c = 2 * Math.PI * 0.618033 * r;
        const u = new THREE.Vector3(l * Math.cos(c) + i_rand, s, l * Math.sin(c) + a);
        u.multiplyScalar(opts.max_radius - opts.min_radius).add(u.clone().normalize().multiplyScalar(opts.min_radius));
        
        const imageSlot = validImageSlots[r];
        
        // 2. TẠO MESH ẢNH
        const geometry = new THREE.PlaneGeometry(1, 1);
        const material = new THREE.MeshBasicMaterial({
          map: this.atlasTexture,
          transparent: true,
          opacity: opts.opacity,
          side: THREE.DoubleSide,
        });
        
        // Điều chỉnh UV để hiển thị đúng ảnh từ atlas
        const col = imageSlot.slotIndex % this.atlasGridSize.x;
        const row = Math.floor(imageSlot.slotIndex / this.atlasGridSize.x);
        const uvAttribute = geometry.getAttribute('uv');
        const uvArray = uvAttribute.array;
        const uMin = col / this.atlasGridSize.x;
        const uMax = (col + 1) / this.atlasGridSize.x;
        const vMin = 1.0 - (row + 1) / this.atlasGridSize.y;
        const vMax = 1.0 - row / this.atlasGridSize.y;
        for (let i = 0; i < uvArray.length; i += 2) {
          const u_coord = uvArray[i];
          const v_coord = uvArray[i + 1];
          uvArray[i] = uMin + u_coord * (uMax - uMin);
          uvArray[i + 1] = vMin + v_coord * (vMax - vMin);
        }
        uvAttribute.needsUpdate = true;
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // 3. ĐẶT VỊ TRÍ, HƯỚNG VÀ KÍCH THƯỚC CHO MESH ẢNH
        mesh.position.set(u.x, u.y, u.z);
        const direction = new THREE.Vector3(u.x, u.y, u.z).normalize();
        mesh.lookAt(mesh.position.clone().add(direction));
        
        const scale = opts.particle_size * (1.0 + opts.particle_size_dispersion * random);
        const aspectRatio = imageSlot.aspectRatio;
        const finalScale = new THREE.Vector3();
        if (aspectRatio > 1.0) { // Ảnh rộng
            finalScale.set(scale * aspectRatio * 0.8, scale, 1);
        } else { // Ảnh cao hoặc vuông
            finalScale.set(scale, scale / aspectRatio * 0.8, 1);
        }
        mesh.scale.copy(finalScale);
        
        // 4. TẠO HITBOX TƯƠNG ỨNG
        const hitboxScaleMultiplier = 1.7; // Vùng click lớn hơn 30%
        const hitboxGeometry = new THREE.PlaneGeometry(1, 1);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            transparent: true, // Tắt trong suốt
            opacity: 0,
            color: 0x00ff00,      // Màu xanh lá cây để dễ thấy
            //wireframe: true,      // Hiển thị dạng lưới để không che mất ảnh
            side: THREE.DoubleSide
        });
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        
        // Đặt hitbox trùng vị trí và hướng với ảnh
        hitbox.position.copy(mesh.position);
        hitbox.quaternion.copy(mesh.quaternion);
        
        // Scale hitbox để nó lớn hơn ảnh nhưng vẫn giữ đúng tỷ lệ
        hitbox.scale.set(
            finalScale.x * hitboxScaleMultiplier,
            finalScale.y * hitboxScaleMultiplier,
            1
        );
        
        // Gán index vào hitbox và thêm vào scene
        hitbox.userData.imageIndex = r; 
        this.imageHitboxes.push(hitbox);
        this.scene.add(hitbox);
        
        // 5. LƯU TRỮ DỮ LIỆU
        this.imageParticleData.push({
          random: random,
          aspectRatio: imageSlot.aspectRatio,
          instanceID: imageSlot.slotIndex,
          basePosition: new THREE.Vector3(u.x, u.y, u.z),
          mesh: mesh,
          hitbox: hitbox,
          url: imageSlot.url,
          originalUVs: new Float32Array(uvArray),
          isHighRes: false
        });
        
        this.imageParticleMeshes.push(mesh);
        this.scene.add(mesh);
      }
  }

  /**
   * Chuyển một ảnh sang phiên bản chất lượng cao BẰNG CÁCH TẠO CANVAS MỚI.
   * @param {object} imageData - Đối tượng dữ liệu từ mảng this.imageParticleData
   */
  async switchToHighRes(imageData) {
    if (!imageData || imageData.isHighRes) return;

    const { mesh, url } = imageData;
    let highResCompositeTexture;

    // 1. Kiểm tra cache
    if (this.textureCache.has(url)) {
      highResCompositeTexture = this.textureCache.get(url);
    } else {
      // 2. Nếu không có trong cache, tải ảnh và vẽ lên canvas mới
      try {
        const highResImage = await this.imageLoader.loadAsync(url);
        
        // Tạo canvas tạm thời với độ phân giải cao hơn
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        const highResSize = 2048; // Kích thước texture chất lượng cao, có thể là 512 hoặc 1024
        tempCanvas.width = highResSize;
        tempCanvas.height = highResSize;

        // Sử dụng hàm vẽ Polaroid đã tái cấu trúc
        this.drawPolaroid(tempCtx, highResImage, 0, 0, highResSize, highResSize);

        // Tạo texture từ canvas mới này
        highResCompositeTexture = new THREE.CanvasTexture(tempCanvas);
        highResCompositeTexture.encoding = THREE.sRGBEncoding;
        highResCompositeTexture.needsUpdate = true; // Rất quan trọng!
        highResCompositeTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

        // Lưu texture ĐÃ ĐƯỢC TỔ HỢP vào cache
        this.textureCache.set(url, highResCompositeTexture);

      } catch (error) {
        console.error("Không thể tải và xử lý ảnh chất lượng cao:", url, error);
        return; // Dừng lại nếu có lỗi
      }
    }

    // 3. Áp dụng texture và UV mới
    mesh.material.map = highResCompositeTexture;
    mesh.geometry.attributes.uv.copyArray(this.defaultUVs);
    mesh.geometry.attributes.uv.needsUpdate = true;
    mesh.material.needsUpdate = true;
    imageData.isHighRes = true;
  }

  switchToLowRes(imageData) {
    if (!imageData || !imageData.isHighRes) return;

    const { mesh, originalUVs } = imageData;

    // 1. Khôi phục texture atlas và UV gốc
    mesh.material.map = this.atlasTexture;
    mesh.geometry.attributes.uv.copyArray(originalUVs);
    mesh.geometry.attributes.uv.needsUpdate = true;
    mesh.material.needsUpdate = true;
    imageData.isHighRes = false;
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
      const hitbox = data.hitbox; 
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
      hitbox.position.copy(worldPos);
      
      // Make images face outwards from galaxy center
      const direction = worldPos.clone().normalize();
      mesh.lookAt(mesh.position.clone().add(direction));
      hitbox.quaternion.copy(mesh.quaternion);
      
      // Apply size scaling
      const scale = opts.particle_size * (1.0 + opts.particle_size_dispersion * data.random);
      const aspectRatio = data.aspectRatio;
      
      if (aspectRatio > 1.0) {
        mesh.scale.set(scale * aspectRatio * 0.8, scale, scale);
      } else {
        mesh.scale.set(scale, scale / aspectRatio * 0.8, scale);
      }
      hitbox.scale.copy(mesh.scale);
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
    
// --- KHỐI LOGIC THEO DÕI MỚI VÀ CẢI TIẾN ---
    if (this.followingImage) {
        const targetMesh = this.followingImage;

        const targetPosition = new THREE.Vector3();
        targetMesh.getWorldPosition(targetPosition);

        const normal = new THREE.Vector3(0, 0, 1);
        normal.applyQuaternion(targetMesh.quaternion);
        let cameraIdealPosition = targetPosition.clone().add(normal.multiplyScalar(this.cameraImageOffset));

        // <<< THÊM DÒNG NÀY ĐỂ ÁP DỤNG HIỆU CHỈNH >>>
        // Chúng ta cần xoay vector hiệu chỉnh theo hướng của camera để nó luôn đẩy "ngang" màn hình.
        const offset = this.cameraCenteringOffset.clone().applyQuaternion(this.camera.quaternion);
        cameraIdealPosition.add(offset);
        // 3. Di chuyển mượt mà cả camera và mục tiêu của controls
        this.camera.position.lerp(cameraIdealPosition, 0.05); 
        this.controls.target.lerp(targetPosition, 0.05);
    }
    // --- KẾT THÚC KHỐI LOGIC MỚI ---
    
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