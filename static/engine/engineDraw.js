/** 
 * LittleJS Drawing System
 * <br> - Hybrid with both Canvas2D and WebGL available
 * <br> - Super fast tile sheet rendering with WebGL
 * <br> - Can apply rotation, mirror, color and additive color
 * <br> - Many useful utility functions
 * <br>
 * <br>LittleJS uses a hybrid rendering solution with the best of both Canvas2D and WebGL.
 * <br>There are 3 canvas/contexts available to draw to...
 * <br> - mainCanvas - 2D background canvas, non WebGL stuff like tile layers are drawn here.
 * <br> - glCanvas - Used by the accelerated WebGL batch rendering system.
 * <br> - overlayCanvas - Another 2D canvas that appears on top of the other 2 canvases.
 * <br>
 * <br>The WebGL rendering system is very fast with some caveats...
 * <br> - The default setup supports only 1 tile sheet, to support more call glCreateTexture and glSetTexture
 * <br> - Switching blend modes (additive) or textures causes another draw call which is expensive in excess
 * <br> - Group additive rendering together using renderOrder to mitigate this issue
 * <br>
 * <br>The LittleJS rendering solution is intentionally simple, feel free to adjust it for your needs!
 * @namespace Draw
 */

'use strict';

/** Tile sheet for batch rendering system
 *  @type {Image}
 *  @memberof Draw */
const tileImage = new Image();

/** The primary 2D canvas visible to the user
 *  @type {HTMLCanvasElement}
 *  @memberof Draw */
let mainCanvas;

/** 2d context for mainCanvas
 *  @type {CanvasRenderingContext2D}
 *  @memberof Draw */
let mainContext;

/** A canvas that appears on top of everything the same size as mainCanvas
 *  @type {HTMLCanvasElement}
 *  @memberof Draw */
let overlayCanvas;

/** 2d context for overlayCanvas
 *  @type {CanvasRenderingContext2D}
 *  @memberof Draw */
let overlayContext;

/** The size of the main canvas (and other secondary canvases) 
 *  @type {Vector2}
 *  @memberof Draw */
let mainCanvasSize = vec2();

/** Convert from screen to world space coordinates
 *  @param {Vector2} screenPos
 *  @return {Vector2}
 *  @memberof Draw */
const screenToWorld = (screenPos)=>
    screenPos.add(vec2(.5)).subtract(mainCanvasSize.scale(.5)).multiply(vec2(1/cameraScale,-1/cameraScale)).add(cameraPos);

/** Convert from world to screen space coordinates
 *  @param {Vector2} worldPos
 *  @return {Vector2}
 *  @memberof Draw */
const worldToScreen = (worldPos)=>
    worldPos.subtract(cameraPos).multiply(vec2(cameraScale,-cameraScale)).add(mainCanvasSize.scale(.5)).subtract(vec2(.5));

/** Draw textured tile centered in world space, with color applied if using WebGL
 *  @param {Vector2} pos                                - Center of the tile in world space
 *  @param {Vector2} [size=new Vector2(1,1)]            - Size of the tile in world space, width and height
 *  @param {Number}  [tileIndex=-1]                     - Tile index to use, negative is untextured
 *  @param {Vector2} [tileSize=tileSizeDefault]         - Tile size in source pixels
 *  @param {Color}   [color=new Color(1,1,1)]           - Color to modulate with
 *  @param {Number}  [angle=0]                          - Angle to rotate by
 *  @param {Boolean} [mirror=0]                         - If true image is flipped along the Y axis
 *  @param {Color}   [additiveColor=new Color(0,0,0,0)] - Additive color to be applied
 *  @param {Boolean} [useWebGL=glEnable]                - Use accelerated WebGL rendering
 *  @memberof Draw */
function drawTile(pos, size=vec2(1), tileIndex=-1, tileSize=tileSizeDefault, color=new Color, angle=0, mirror, 
    additiveColor=new Color(0,0,0,0), useWebGL=glEnable)
{
    showWatermark && ++drawCount;
    if (glEnable && useWebGL)
    {
        if (tileIndex < 0 || !tileImage.width)
        {
            // if negative tile index or image not found, force untextured
            glDraw(pos.x, pos.y, size.x, size.y, angle, 0, 0, 0, 0, 0, color.rgbaInt()); 
        }
        else
        {
            // calculate uvs and render
            const cols = tileImageSize.x / tileSize.x |0;
            const uvSizeX = tileSize.x / tileImageSize.x;
            const uvSizeY = tileSize.y / tileImageSize.y;
            const uvX = (tileIndex%cols)*uvSizeX, uvY = (tileIndex/cols|0)*uvSizeY;
            
            glDraw(pos.x, pos.y, mirror ? -size.x : size.x, size.y, angle, 
                uvX + tileImageFixBleed.x, uvY + tileImageFixBleed.y, 
                uvX - tileImageFixBleed.x + uvSizeX, uvY - tileImageFixBleed.y + uvSizeY, 
                color.rgbaInt(), additiveColor.rgbaInt()); 
        }
    }
    else
    {
        // normal canvas 2D rendering method (slower)
        drawCanvas2D(pos, size, angle, mirror, (context)=>
        {
            if (tileIndex < 0)
            {
                // if negative tile index, force untextured
                context.fillStyle = color.rgba();
                context.fillRect(-.5, -.5, 1, 1);
            }
            else
            {
                // calculate uvs and render
                const cols = tileImageSize.x / tileSize.x |0;
                const sX = (tileIndex%cols)*tileSize.x   + tileFixBleedScale;
                const sY = (tileIndex/cols|0)*tileSize.y + tileFixBleedScale;
                const sWidth  = tileSize.x - 2*tileFixBleedScale;
                const sHeight = tileSize.y - 2*tileFixBleedScale;
                context.globalAlpha = color.a; // only alpha is supported
                context.drawImage(tileImage, sX, sY, sWidth, sHeight, -.5, -.5, 1, 1);
            }
        });
    }
}

/** Draw colored rect centered on pos
 *  @param {Vector2} pos
 *  @param {Vector2} [size=new Vector2(1,1)]
 *  @param {Color}   [color=new Color(1,1,1)]
 *  @param {Number}  [angle=0]
 *  @param {Boolean} [useWebGL=glEnable]
 *  @memberof Draw */
function drawRect(pos, size, color, angle, useWebGL)
{
    drawTile(pos, size, -1, tileSizeDefault, color, angle, 0, 0, useWebGL);
}

/** Draw textured tile centered on pos in screen space
 *  @param {Vector2} pos                        - Center of the tile
 *  @param {Vector2} [size=new Vector2(1,1)]    - Size of the tile
 *  @param {Number}  [tileIndex=-1]             - Tile index to use, negative is untextured
 *  @param {Vector2} [tileSize=tileSizeDefault] - Tile size in source pixels
 *  @param {Color}   [color=new Color]
 *  @param {Number}  [angle=0]
 *  @param {Boolean} [mirror=0]
 *  @param {Color}   [additiveColor=new Color(0,0,0,0)]
 *  @param {Boolean} [useWebGL=glEnable]
 *  @memberof Draw */
function drawTileScreenSpace(pos, size=vec2(1), tileIndex, tileSize, color, angle, mirror, additiveColor, useWebGL)
{
    drawTile(screenToWorld(pos), size.scale(1/cameraScale), tileIndex, tileSize, color, angle, mirror, additiveColor, useWebGL);
}

/** Draw colored rectangle in screen space
 *  @param {Vector2} pos
 *  @param {Vector2} [size=new Vector2(1,1)]
 *  @param {Color}   [color=new Color(1,1,1)]
 *  @param {Number}  [angle=0]
 *  @param {Boolean} [useWebGL=glEnable]
 *  @memberof Draw */
function drawRectScreenSpace(pos, size, color, angle, useWebGL)
{
    drawTileSrceenSpace(pos, size, -1, tileSizeDefault, color, angle, 0, 0, useWebGL);
}

/** Draw colored line between two points
 *  @param {Vector2} posA
 *  @param {Vector2} posB
 *  @param {Number}  [thickness=.1]
 *  @param {Color}   [color=new Color(1,1,1)]
 *  @param {Boolean} [useWebGL=glEnable]
 *  @memberof Draw */
function drawLine(posA, posB, thickness=.1, color, useWebGL)
{
    const halfDelta = vec2((posB.x - posA.x)/2, (posB.y - posA.y)/2);
    const size = vec2(thickness, halfDelta.length()*2);
    drawRect(posA.add(halfDelta), size, color, halfDelta.angle(), 0, 0, useWebGL);
}

/** Draw directly to a 2d canvas context in world space
 *  @param {Vector2}  pos
 *  @param {Vector2}  size
 *  @param {Number}   angle
 *  @param {Boolean}  mirror
 *  @param {Function} drawFunction
 *  @param {CanvasRenderingContext2D} [context=mainContext]
 *  @memberof Draw */
function drawCanvas2D(pos, size, angle, mirror, drawFunction, context = mainContext)
{
    // create canvas transform from world space to screen space
    pos = worldToScreen(pos);
    size = size.scale(cameraScale);
    context.save();
    context.translate(pos.x+.5|0, pos.y-.5|0);
    context.rotate(angle);
    context.scale(mirror ? -size.x : size.x, size.y);
    drawFunction(context);
    context.restore();
}

/** Draw text on overlay canvas in world space
 *  @param {String}  text
 *  @param {Vector2} pos
 *  @param {Number}  [size=1]
 *  @param {Color}   [color=new Color(1,1,1)]
 *  @param {Number}  [lineWidth=0]
 *  @param {Color}   [lineColor=new Color(0,0,0)]
 *  @param {String}  [textAlign='center']
 *  @memberof Draw */
function drawText(text, pos, size=1, color=new Color, lineWidth=0, lineColor=new Color(0,0,0), textAlign='center', font=fontDefault)
{
    pos = worldToScreen(pos);
    overlayContext.font = size*cameraScale + 'px '+ font;
    overlayContext.textAlign = textAlign;
    overlayContext.textBaseline = 'middle';
    if (lineWidth)
    {
        overlayContext.lineWidth = lineWidth*cameraScale;
        overlayContext.strokeStyle = lineColor.rgba();
        overlayContext.strokeText(text, pos.x, pos.y);
    }
    overlayContext.fillStyle = color.rgba();
    overlayContext.fillText(text, pos.x, pos.y);
}

/** Enable normal or additive blend mode
 *  @param {Boolean} [additive=0]
 *  @param {Boolean} [useWebGL=glEnable]
 *  @memberof Draw */
function setBlendMode(additive, useWebGL=glEnable)
{
    if (glEnable && useWebGL)
        glSetBlendMode(additive);
    else
        mainContext.globalCompositeOperation = additive ? 'lighter' : 'source-over';
}

///////////////////////////////////////////////////////////////////////////////
// Fullscreen mode

/** Returns true if fullscreen mode is active
 *  @return {Boolean}
 *  @memberof Draw */
const isFullscreen =()=> document.fullscreenElement;

/** Toggle fullsceen mode
 *  @memberof Draw */
function toggleFullscreen()
{
    if (isFullscreen())
    {
        if (document.exitFullscreen)
            document.exitFullscreen();
        else if (document.mozCancelFullScreen)
            document.mozCancelFullScreen();
    }
    else
    {
        if (document.body.webkitRequestFullScreen)
            document.body.webkitRequestFullScreen();
        else if (document.body.mozRequestFullScreen)
            document.body.mozRequestFullScreen();
    }
}