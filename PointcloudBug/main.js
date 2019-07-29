'use strict'

/* Document URN Array */
let urn = [];
urn.push('dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6YW5qYWxlZTAwMS9CaW1UZXN0TW9kZWwubndk'); // Hospital model

let documentId = 'urn:' + urn[0]; // Current Model ID

/* HTTP Request Functions */
function getForgeToken(callback) {
    jQuery.ajax({
        url: '/api/forge/oauth/token',
        success: function (res) {
            callback(res.access_token, res.expires_in);
        },
        error: function (err) {
            console.log('Failed to get access token. Err: '+ err);
            alert('Failed to get access token. Err: '+ err);
        }
    });
}

/* Viewer */
let viewer;
const viewerDiv = document.getElementById('MyViewerDiv');
let viewerRootNode;
let defaultModel;

let model;
const options = {
    env: 'AutodeskProduction',
    api: 'derivativeV2',
    accessToken: "eyJhbGciOiJIUzI1NiIsImtpZCI6Imp3dF9zeW1tZXRyaWNfa2V5In0.eyJjbGllbnRfaWQiOiJ6bE4wbkJaS2dyM0M5a2VnclF4Ym1qQlRtVlVaUVluRSIsImV4cCI6MTU2NDQzMTE3Niwic2NvcGUiOlsiZGF0YTpyZWFkIiwiZGF0YTp3cml0ZSIsImRhdGE6Y3JlYXRlIiwiZGF0YTpzZWFyY2giLCJidWNrZXQ6Y3JlYXRlIiwiYnVja2V0OnJlYWQiLCJidWNrZXQ6dXBkYXRlIiwiYnVja2V0OmRlbGV0ZSIsImFjY291bnQ6cmVhZCIsImFjY291bnQ6d3JpdGUiLCJjb2RlOmFsbCJdLCJhdWQiOiJodHRwczovL2F1dG9kZXNrLmNvbS9hdWQvand0ZXhwNjAiLCJqdGkiOiJTOHhiMmExY0JtQmFYYkxmY2ZnVmFnc3o4SUFERTFaQVVKQzllQzRmYVRJRjl2eDFkaUMzd3RxOW1JeE12aTFPIn0.ZVjDA_iyjmGQFrXYlmDU322FUL7zEuQgwRIOwyqRVHQ",
    // getAccessToken: getForgeToken
};

Autodesk.Viewing.Initializer(options, function() {
    const config = {
        //extensions: [ 'ClickableMarkup' ]
    };

    viewer = new Autodesk.Viewing.Private.GuiViewer3D(viewerDiv, config);
    var startedCode = viewer.start();
    if (startedCode > 0) {
        console.error('Failed to create a Viewer: WebGL not supported.');
        return;
    }

    console.log('Initialization complete, loading a model next...');

    Autodesk.Viewing.Document.load(documentId, onDocumentLoadSuccess, onDocumentLoadFailure);


});

// viewer = new Autodesk.Viewing.GuiViewer3D(viewerDiv);
// Autodesk.Viewing.Document.load(documentId, onDocumentLoadSuccess, onDocumentLoadFailure);

function onDocumentLoadSuccess(viewerDocument) {
    console.log('Successfully fetched forge manifest. Now loading document node');
    viewerRootNode = viewerDocument.getRoot();
    defaultModel = viewerRootNode.getDefaultGeometry();
    console.log(defaultModel.constructor);
    console.log(defaultModel);

    viewer.loadDocumentNode(viewerDocument, defaultModel);

    /* Load Extensions that Rely on Viewer being Loaded */
    viewer.addEventListener(Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT, function() {
        // Save model instance
        model = viewer.impl.modelQueue().getModels()[0];

        // Load Extensions
        viewer.loadExtension('ClickableMarkup');
    });

}

function onDocumentLoadFailure() {
    console.error('Failed fetching Forge manifest');
}

