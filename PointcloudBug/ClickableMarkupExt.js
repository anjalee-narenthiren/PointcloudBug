
class CameraInfo {
    constructor(cameraView, cutPlanes, position) {
        // Used to set the camera view
        this.cameraView = cameraView;
        this.cutPlanes = cutPlanes;
        this.position = position; // Position where markup icon should go
    }
}

function ClickableMarkup() {
    /* Preferences */
    this.prefs = {
        SET_SECTION_PLANE: true, // Boolean value. Determines whether or not section planes should be set when a new camera view is set
        POINT_CLOUD_OPACITY: 0.5 // Opacity of pointcloud objects
    };

    /* Neccessary vars */
    Autodesk.Viewing.Extension.call(this, viewer, options);
    this.overlayManager = new Autodesk.Viewing.OverlayManager(viewer.impl);
    this.sceneName = 'scene';

    this.cameraInfo = []; // Array to store camera info
    this.markupPositions = []; // Float32Array to store markupPositions

    this.viewer = viewer; // Viewer

    this.tooltip;

    this.geometry;
    this.material;
    this.points; // THREE.Points

    this.scene; // Save a reference to the current overlay scene once it is created
    this.camera // Save a reference to the camera

    /* THREE.Points Display Params */
    this.size = 150.0; // markup size.  Change this if markup size is too big or small
    this.threshold = 9.0; // Higher threshold means the raycaster is more sensitive

    /* Detect click */
    this.raycaster; // Used to detect when mouse is over pointcloud
    this.intersects; // Array that stores clicked point cloud points
    this.hitIndex; // Index of point in pointcloud that is currently moused over

    // Fields neccessary for Three.Points
    this.pointCloudTextureURL = 'http://localhost:3000/texture.png';
    this.vertexShader = `
        uniform float size;
        varying vec3 vColor;
        void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            gl_PointSize = size * ( size / (length(mvPosition.xyz) + 1.0) );
            gl_Position = projectionMatrix * mvPosition;
        }
    `
    

    this.fragmentShader = `
        uniform sampler2D tex;
        varying vec3 vColor;
        void main() {
            gl_FragColor = vec4( vColor.x, vColor.x, vColor.x, 1.0 );
            gl_FragColor = gl_FragColor * texture2D(tex, vec2((gl_PointCoord.x+vColor.y*1.0)/4.0, 1.0-gl_PointCoord.y));
            if (gl_FragColor.w < 0.5) discard;
        }
    `
}

ClickableMarkup.prototype = Object.create(Autodesk.Viewing.Extension.prototype);
ClickableMarkup.prototype.constructor = ClickableMarkup;


ClickableMarkup.prototype.load = function () {
    const self = this;

    /* Initizialize */
    console.log('Start loading clickableMarkup extension');
    this.camera = this.viewer.navigation.getCamera(); // Save camera instance
    console.log(this.camera);
    this.initCameraInfo(); // Populate cameraInfo array
    this.overlayManager.addScene(this.sceneName); // Add scene to overlay manager
    this.scene = this.viewer.impl.overlayScenes[this.sceneName].scene; // Save reference to the scene

    /* Create pointCloud */
    this.geometry = new THREE.Geometry();
    this.cameraInfo.forEach( function(e) {
            // console.log(`   > add ${e.position}`)
            self.geometry.vertices.push(e.position);
        }
    );
    this.geometry.computeBoundingBox();
    // const material = new THREE.PointCloudMaterial( { size: 50, color: 0Xff0000, opacity: 100, sizeAttenuation: true } );
    const texture = THREE.ImageUtils.loadTexture(this.pointCloudTextureURL);
    this.material = new THREE.ShaderMaterial({
        vertexColors: THREE.VertexColors,
        opacity: this.prefs.POINT_CLOUD_OPACITY,
        fragmentShader: this.fragmentShader,
        vertexShader: this.vertexShader,
        depthWrite: true,
        depthTest: true,
        uniforms: {
            size: {type: "f", value: self.size},
            tex: {type: "t", value: texture}
        }
    });
    this.points = new THREE.PointCloud( this.geometry, this.material );

    /* Add the pointcloud to the scene */
    this.overlayManager.addMesh(this.points, this.sceneName); /* >>> THIS WORKS  SO IT RENDERS THE POINTCLOUD AT THE BEGINNING OF LOAD <<< */

    /* Set up event listeners */
    document.addEventListener('click', event => {
        event.preventDefault();

        this.setRaycasterIntersects(event); // Fill this.intersects with pointcloud indices that are currently selected

        if (this.intersects.length > 0) {
            console.log('Raycaster hit index: ' + this.hitIndex + JSON.stringify(this.intersects[0]));
            this.setCameraView(this.hitIndex);
        } else {
            /*  >>>>  THE PROBLEM IS HERE - IT DOESN'T RENDER THE NEW POINTCLOUD POINTS <<<< */
            const mousePos = this.screenToWorld(event);
            if (mousePos) { // Only add point to scene if the user clicked on the building
                const vertexMousePos = new THREE.Vector3(mousePos.x, mousePos.y, mousePos.z);
                this.geometry.vertices.push(vertexMousePos);
                this.geometry.verticesNeedUpdate = true;
                this.geometry.computeBoundingBox();

                this.points = new THREE.PointCloud(this.geometry, this.material);
                this.overlayManager.addMesh(this.points, this.sceneName);
                this.viewer.impl.invalidate(true); // Render the scene again
            }
        }

    }, false);

    console.log('ClickableMarkup extension is loaded!');
    return true;
};

ClickableMarkup.prototype.unload = function () {
    console.log('ClickableMarkup is now unloaded!');
    return true;
};

/* ----------------- Other Useful Functions -------------------- */

ClickableMarkup.prototype.initCameraInfo = function() {
    const savedViewpointsRaw = viewerRootNode.getNamedViews();

    console.log('start initCameraInfo() - savedViewpointsRaw = ');
    console.log(viewerRootNode);
    console.log(savedViewpointsRaw);

    const self = this;

    savedViewpointsRaw.forEach(function(viewRaw) {
        const viewpoint = viewRaw.data; // Set viewpoint

        const cameraNode = viewpoint.camera; // Set camera to viewpoint
        let camera = Autodesk.Viewing.BubbleNode.readCameraFromArray(cameraNode);
        const sectionPlane = viewpoint.sectionPlane;
        const viewpointName = viewpoint.name;

        // Copy camera args
        const placementWithOffset = model.myData.placementWithOffset;
        const forge_model_offset = model.myData.globalOffset;

        camera.position.applyMatrix4(placementWithOffset);
        camera.target.applyMatrix4(placementWithOffset);

        const cameraView =
            {
                aspect: camera.aspect,
                isPerspective: camera.isPerspective,
                fov: camera.fov,
                position: camera.position,
                target: camera.target,
                up: camera.up,
                orthoScale: camera.orthoScale,
                name: viewpointName
            };

        // Copy sectioning for plane
        let cutplanes;
        if (self.prefs.SET_SECTION_PLANE && sectionPlane) { // Only define cutplanes if sectionPlane is defined
            const clip_plane = {x: sectionPlane[0], y: sectionPlane[1], z: sectionPlane[2], d: sectionPlane[3]};

            const dis_in_forge = (forge_model_offset.x * clip_plane.x +
                forge_model_offset.y * clip_plane.y +
                forge_model_offset.z * clip_plane.z) + clip_plane.d;

            cutplanes = [
                new THREE.Vector4(clip_plane.x, clip_plane.y, clip_plane.z, dis_in_forge)
            ];
        }
        const curCameraInfo = new CameraInfo(cameraView, cutplanes, cameraView.target);
        self.cameraInfo.push(curCameraInfo);
        self.markupPositions.push(cameraView.target.x);
        self.markupPositions.push(cameraView.target.y);
        self.markupPositions.push(cameraView.target.z);
    })

    self.markupPositions = new Float32Array(self.markupPositions);

    console.log('Done initCameraInfo(): camerInfo array =');
    console.log(self.cameraInfo);
    console.log(self.markupPositions);
};

ClickableMarkup.prototype.setCameraView = function(viewIndex) {
    // Apply Camera and Plane Values to viewer
    try {
        console.log(`ClickableMarkup.setCameraView for cameraInfo[${viewIndex}]`);
        if (this.cameraInfo[viewIndex].cutPlanes) {
            this.viewer.setCutPlanes(this.cameraInfo[viewIndex].cutPlanes);
        } else console.log(`\t cameraInfo[${viewIndex}].cutPlanes is undefined`)
        this.viewer.impl.setViewFromCamera(this.cameraInfo[viewIndex].cameraView, true, false);

        /* Run this instead in order to make it faster - but it doesn't go to the same position every time */
        // const cameraView = this.cameraInfo[viewIndex].cameraView;
        // console.log(cameraView);
        // this.viewer.navigation.setView(cameraView.position, cameraView.target);
    }
    catch (err) {
        console.warn(`ClickableMarkup.setCameraView failed for cameraInfo[${viewIndex}] | Err: ${err}`);
    }
};

ClickableMarkup.prototype.pointToRaycaster = function(domElement, camera, point) {

    const pointerVector = new THREE.Vector3()
    const pointerDir = new THREE.Vector3()
    const ray = new THREE.Raycaster()

    const rect = domElement.getBoundingClientRect()

    const x =  ((point.x - rect.left) / rect.width)  * 2 - 1
    const y = -((point.y - rect.top)  / rect.height) * 2 + 1

    if (camera.isPerspective) {

        pointerVector.set(x, y, 0.5)

        pointerVector.unproject(camera)

        ray.set(camera.position,
            pointerVector.sub(
                camera.position).normalize())

    } else {

        pointerVector.set(x, y, -1)

        pointerVector.unproject(camera)

        pointerDir.set(0, 0, -1)

        ray.set(pointerVector,
            pointerDir.transformDirection(
                camera.matrixWorld))
    }

    return ray
};

ClickableMarkup.prototype.setRaycaster = function(event, threshold = this.threshold) {
    const mouse = new THREE.Vector2();
    mouse.x = event.clientX;
    mouse.y = event.clientY;

    this.raycaster = this.pointToRaycaster(
        this.viewer.impl.canvas,
        this.viewer.impl.camera, mouse);

    this.raycaster.params.PointCloud.threshold = threshold;
};

ClickableMarkup.prototype.setRaycasterIntersects = function(event, threshold = this.threshold) {
    this.setRaycaster(event, threshold);
    this.intersects = this.raycaster.intersectObject(this.points);

};

/* Helper Functions for creating markups */

// Find xyz coord of mouse if the mouse is touching the building (will return null if clicking on empty space)
ClickableMarkup.prototype.screenToWorld = function(event) {
    const mouse = new THREE.Vector2();
    mouse.x = event.clientX;
    mouse.y = event.clientY;

    const viewport = this.viewer.navigation.getScreenViewport();

    const n = {
        x: (mouse.x - viewport.left) / viewport.width,
        y: (mouse.y - viewport.top ) / viewport.height
    };

    return this.viewer.utilities.getHitPoint(n.x, n.y);
};

ClickableMarkup.prototype.getSelection = function(screenPoint, threshold = this.threshold) {

    const rayCaster = this.pointToRaycaster(
        this.viewer.impl.canvas,
        this.viewer.impl.camera, {
            x: screenPoint.x,
            y: screenPoint.y
        })

    const res = rayCaster.intersectObjects(
        [this.pointCloud], true)

    if (res.length) {

        return this.markups.filter((markup) => {

            const diff = {
                x: res[0].point.x - markup.point.x,
                y: res[0].point.y - markup.point.y,
                z: res[0].point.z - markup.point.z
            }

            const dist = Math.sqrt(
                diff.x * diff.x +
                diff.y * diff.y +
                diff.z * diff.z)

            return dist < treshold
        })
    }

    return []
};

ClickableMarkup.prototype.onCreateMarkupClick = function(event) {

    const hitTest = this.viewer.clientToWorld(
        event.canvasX,
        event.canvasY,
        true)

    if (hitTest) {

        const markupInfo = {
            fragId: hitTest.fragId,
            point: hitTest.point,
            dbId: hitTest.dbId
        }

        // Add it to canvas

        return true
    }
};

/*********                              ***********/

Autodesk.Viewing.theExtensionManager.registerExtension('ClickableMarkup', ClickableMarkup);
