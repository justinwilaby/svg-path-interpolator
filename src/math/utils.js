function degToRads(deg){
    return Math.PI * deg / 180;
}

function radToDeg(rad){
    return rad * 180 / Math.PI;
}

function isNullOrUndefined(value){
    return Boolean(value === undefined || value === null);
}

/**
 * Rotates a point around the given origin
 * by the specified radians and returns the
 * rotated point.
 *
 * @param originX The x coordinate of the point to rotate around.
 * @param originY The y coordinate of the point to rotate around.
 * @param x The x coordinate of the point to be rotated.
 * @param y The y coordinate of the point to be rotated.
 * @param radiansX Radians to rotate along the x axis.
 * @param radiansY Radians to rotate along the y axis.
 *
 * @returns {Object} The point with the rotated coordinates.
 */
function rotatePoint(originX, originY, x, y, radiansX, radiansY) {
    const v = {x: x - originX, y: y - originY};
    const vx = (v.x * Math.cos(radiansX)) - (v.y * Math.sin(radiansX));
    const vy = (v.x * Math.sin(radiansY)) + (v.y * Math.cos(radiansY));
    return {x: vx + originX, y: vy + originY};
}


module.exports = {
    degToRads,
    isNullOrUndefined,
    radToDeg,
    rotatePoint
};