/**
 * Javascript adaptation of AffineTransform.ccp from
 * https://github.com/WebKit/webkit/blob/66e68cd8d7bf4ea1cf52f31ed9cb242f83ea5b57/Source/WebCore/platform/graphics/transforms/AffineTransform.cpp
 */
/*
 * Copyright (C) Research In Motion Limited 2010. All rights reserved.
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Library General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public License
 * along with this library; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
 * Boston, MA 02110-1301, USA.
 */
/*
 * Copyright (C) 2005, 2006 Apple Inc.  All rights reserved.
 *               2010 Dirk Schulze <krit@webkit.org>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
const degToRads = require('./utils').degToRads;
const radToDeg = require('./utils').radToDeg;

class SVGTransform {
    constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
        this.m_transform = [+a, +b, +c, +d, +e, +f];
    }

    makeIdentity() {
        this.setMatrix(1, 0, 0, 1, 0, 0);
    }

    setMatrix(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
        const m_transform = this.m_transform;
        m_transform[0] = +a;
        m_transform[1] = +b;
        m_transform[2] = +c;
        m_transform[3] = +d;
        m_transform[4] = +e;
        m_transform[5] = +f;
    }

    matrix(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0){
        this.setMatrix(a, b, c, d, e, f);
    }

    isIdentity() {
        const m_transform = this.m_transform;

        return (m_transform[0] === 1 && m_transform[1] === 0
        && m_transform[2] === 0 && m_transform[3] === 1
        && m_transform[4] === 0 && m_transform[5] === 0);
    }

    static det(transform) {
        return +(transform[0] * transform[3] - transform[1] * transform[2]);
    }

    get xScale() {
        const m_transform = this.m_transform;

        return Math.sqrt(m_transform[0] * m_transform[0] + m_transform[1] * m_transform[1]);
    }

    get yScale() {
        const m_transform = this.m_transform;
        return Math.sqrt(m_transform[2] * m_transform[2] + m_transform[3] * m_transform[3]);
    }

    get isInvertible() {
        const determinant = SVGTransform.det(this.m_transform);
        return Boolean(determinant && isFinite(determinant));
    }

    inverse() {
        const m_transform = this.m_transform;
        const determinant = SVGTransform.det(m_transform);
        const result = new SVGTransform();
        if (this.isIdentityOrTranslation()) {
            result.m_transform[4] = -m_transform[4];
            result.m_transform[5] = -m_transform[5];
            return result;
        }

        result.m_transform[0] = m_transform[3] / determinant;
        result.m_transform[1] = -m_transform[1] / determinant;
        result.m_transform[2] = -m_transform[2] / determinant;
        result.m_transform[3] = m_transform[0] / determinant;
        result.m_transform[4] = (m_transform[2] * m_transform[5] - m_transform[3] * m_transform[4]) / determinant;
        result.m_transform[5] = (m_transform[1] * m_transform[4] - m_transform[0] * m_transform[5]) / determinant;

        return result;
    }

    isIdentityOrTranslation() {
        const m_transform = this.m_transform;
        return m_transform[0] === 1 && m_transform[1] === 0 && m_transform[2] === 0 && m_transform[3] === 1;
    }

    multiply(other){
        const m_transform = this.m_transform;
        const trans = new SVGTransform();
        const om_transform = other.m_transform;
        const tm_transform = trans.m_transform;

        tm_transform[0] = om_transform[0] * m_transform[0] + om_transform[1] * m_transform[2];
        tm_transform[1] = om_transform[0] * m_transform[1] + om_transform[1] * m_transform[3];
        tm_transform[2] = om_transform[2] * m_transform[0] + om_transform[3] * m_transform[2];
        tm_transform[3] = om_transform[2] * m_transform[1] + om_transform[3] * m_transform[3];
        tm_transform[4] = om_transform[4] * m_transform[0] + om_transform[5] * m_transform[2] + m_transform[4];
        tm_transform[5] = om_transform[4] * m_transform[1] + om_transform[5] * m_transform[3] + m_transform[5];

        this.m_transform = trans.m_transform;
        return this;
    }

    rotate(degrees, x, y){
        const translateFlag = Boolean(x !== undefined && y !== undefined);
        if (translateFlag){
            this.translate(x, y);
        }
        const rads = degToRads(degrees);
        const cosAngle = Math.cos(rads);
        const sinAngle = Math.sin(rads);
        const rot = new SVGTransform(cosAngle, sinAngle, -sinAngle, cosAngle, 0, 0);

        this.multiply(rot);

        if (translateFlag){
            this.translate(-x, -y);
        }
        return this;
    }

    scale(sx, sy){
        const m_transform = this.m_transform;
        if (sy === undefined){
            sy = sx;
        }
        m_transform[0] *= sx;
        m_transform[1] *= sx;
        m_transform[2] *= sy;
        m_transform[3] *= sy;

        return this;
    }

    translate(tx, ty){
        const m_transform = this.m_transform;
        if (this.isIdentityOrTranslation()) {
            m_transform[4] += tx;
            m_transform[5] += ty;
            return this;
        }

        m_transform[4] += tx * m_transform[0] + ty * m_transform[2];
        m_transform[5] += tx * m_transform[1] + ty * m_transform[3];
        return this;
    }

    rotateFromVector(x, y){
        return this.rotate(radToDeg(Math.atan2(y, x)));
    }

    flipX(){
        return this.scale(-1, 1);
    }

    flipY(){
        return this.scale(1, -1);
    }

    shear(sx, sy){
        const m_transform = this.m_transform;
        const a = m_transform[0];
        const b = m_transform[1];

        m_transform[0] += sy * m_transform[2];
        m_transform[1] += sy * m_transform[3];
        m_transform[2] += sx * a;
        m_transform[3] += sx * b;
        return this;
    }

    skew(angleX, angleY){
        return this.shear(Math.tan(degToRads(angleX)), Math.tan(degToRads(angleY)));
    }

    skewX(angle){
        return this.shear(Math.tan(degToRads(angle)), 0);
    }

    skewY(angle){
        return this.shear(0, Math.tan(degToRads(angle)));
    }

    map(x, y){
        const m_transform = this.m_transform;
        return {
            x: (m_transform[0] * x + m_transform[2] * y + m_transform[4]),
            y: (m_transform[1] * x + m_transform[3] * y + m_transform[5])
        }
    }

    mapPoint(point){
        return this.map(point.x, point.y);
    }
}
module.exports = SVGTransform;