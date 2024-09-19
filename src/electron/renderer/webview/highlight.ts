// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as crypto from "crypto";
import * as debounce from "debounce";
import { ipcRenderer } from "electron";

import {
    IEventPayload_R2_EVENT_HIGHLIGHT_CLICK, R2_EVENT_HIGHLIGHT_CLICK,
} from "../../common/events";
import {
    HighlightDrawTypeStrikethrough, HighlightDrawTypeUnderline, HighlightDrawTypeOutline, IColor, IHighlight,
    IHighlightDefinition,
    HighlightDrawTypeBackground,
} from "../../common/highlight";
import { appendCSSInline, isPaginated } from "../../common/readium-css-inject";
import { ISelectionInfo } from "../../common/selection";
import { VERBOSE, IRectSimple, getClientRectsNoOverlap, getBoundingRect, IRect, getTextClientRects, DOMRectListToArray } from "../common/rect-utils";
import { getScrollingElement, isVerticalWritingMode, isTwoPageSpread } from "./readium-css";
import { convertRangeInfo } from "./selection";
import { ReadiumElectronWebviewWindow } from "./state";

import { CLASS_HIGHLIGHT_CONTOUR, CLASS_HIGHLIGHT_CONTOUR_MARGIN, ID_HIGHLIGHTS_CONTAINER, CLASS_HIGHLIGHT_CONTAINER, CLASS_HIGHLIGHT_CURSOR2, CLASS_HIGHLIGHT_COMMON, CLASS_HIGHLIGHT_MARGIN, CLASS_HIGHLIGHT_HOVER, CLASS_HIGHLIGHT_BEHIND } from "../../common/styles";

import { isRTL } from "./readium-css";

import {
Polygon,
Box,
BooleanOperations,
Point,
Face,
Segment,
Vector,
Arc,
ORIENTATION,
CCW, // true
CW, // false
Utils,
Edge,
// PolygonEdge,
} from "@flatten-js/core";
const { unify, subtract } = BooleanOperations;

const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).DEBUG_RECTS = IS_DEV && VERBOSE;

const ENABLE_CSS_HIGHLIGHTS = true;

const cleanupPolygon = (polygonAccumulator: Polygon, off: number) => {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DEBUG_RECTS = (window as any).DEBUG_RECTS;

    const minLength = Math.abs(off) + 1;
    let nSegments = 0;
    let nArcs = 0;
    let total = 0;
    if (DEBUG_RECTS) {
        console.log("--====}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}");
    }
    for (const e of polygonAccumulator.edges) {
        const edge = e as Edge;
        if (edge.isSegment) {
            nSegments++;
            const segment = edge.shape as Segment;
            const l = segment.length;
            if (Utils.LE(l, minLength)) {
                total++;
                if (DEBUG_RECTS) {
                    console.log("--POLYGON SEGMENT small LENGTH: " + l + "(" + off + ")");
                }
            } else {
                if (DEBUG_RECTS) {
                    console.log("--POLYGON SEGMENT ok LENGTH: " + l + "(" + off + ")");
                }
            }
        } else if (edge.isArc) {
            nArcs++;
            if (DEBUG_RECTS) {
                console.log("--POLYGON ARC");
            }
        }
    }
    if (DEBUG_RECTS) {
        console.log("--====");
        console.log("--==== POLYGON SEGMENT small TOTAL 1: " + total);
        console.log("--==== POLYGON SEGMENT small SEGMENTS 1: " + nSegments);
        console.log("--==== POLYGON SEGMENT small ARCS 1: " + nArcs);
    }
    total = 0;
    nSegments = 0;
    nArcs = 0;
    if (DEBUG_RECTS) {
        console.log("--====}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}");
    }
    for (const f of polygonAccumulator.faces) {
        const face = f as Face;
        for (const e of face.edges) {
            const edge = e as Edge;
            if (edge.isSegment) {
                nSegments++;
                const segment = edge.shape as Segment;
                const l = segment.length;
                if (Utils.LE(l, minLength)) {
                    total++;
                    if (DEBUG_RECTS) {
                        console.log("--POLYGON SEGMENT small LENGTH: " + l + "(" + off + ")");
                    }
                } else {
                    if (DEBUG_RECTS) {
                        console.log("--POLYGON SEGMENT ok LENGTH: " + l + "(" + off + ")");
                    }
                }
            } else if (edge.isArc) {
                nArcs++;
                if (DEBUG_RECTS) {
                    console.log("--POLYGON ARC");
                }
            }
        }
    }
    if (DEBUG_RECTS) {
        console.log("--====");
        console.log("--==== POLYGON SEGMENT small TOTAL 2: " + total);
        console.log("--==== POLYGON SEGMENT small SEGMENTS 2: " + nSegments);
        console.log("--==== POLYGON SEGMENT small ARCS 2: " + nArcs);
    }
    total = 0;
    nSegments = 0;
    nArcs = 0;
    if (DEBUG_RECTS) {
        console.log("--====}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}");
    }
    for (const f of polygonAccumulator.faces) {
        const face = f as Face;
        let edge = face.first;
        while (edge) {
            if (edge.isSegment) {
                nSegments++;
                const segment = edge.shape as Segment;
                const l = segment.length;
                if (Utils.LE(l, minLength)) {
                    total++;
                    if (DEBUG_RECTS) {
                        console.log("--POLYGON SEGMENT small LENGTH: " + l + "(" + off + ")");
                    }
                } else {
                    if (DEBUG_RECTS) {
                        console.log("--POLYGON SEGMENT ok LENGTH: " + l + "(" + off + ")");
                    }
                }
            } else if (edge.isArc) {
                nArcs++;
                if (DEBUG_RECTS) {
                    console.log("--POLYGON ARC");
                }
            }
            if (edge == face.last) {
                break;
            }
            edge = edge.next;
        }
    }
    if (DEBUG_RECTS) {
        console.log("--====");
        console.log("--==== POLYGON SEGMENT small TOTAL 3: " + total);
        console.log("--==== POLYGON SEGMENT small SEGMENTS 3: " + nSegments);
        console.log("--==== POLYGON SEGMENT small ARCS 3: " + nArcs);

        console.log("--====}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}");
    }

    const faces: Face[] = Array.from(polygonAccumulator.faces);
    for (const f of faces) {
        const face = f as Face;
        if (DEBUG_RECTS) {
            console.log("~~~~ POLY FACE");
        }

        const edges = Array.from(face.edges);
        const edgeShapes = edges.map((edge) => edge.shape);
        let chainedEdgeShapes: Array<Segment | Arc> = [];

        while (edgeShapes.length) {
            if (DEBUG_RECTS) {
                console.log("~~~~ POLY EDGE SHAPE");
            }

            if (!chainedEdgeShapes.length) {
                const last = edgeShapes.pop()!;
                chainedEdgeShapes.push(last);
                continue;
            }

            // peek not pop
            const lastInChain = chainedEdgeShapes[chainedEdgeShapes.length - 1];

            const lastInChainStartPoint = (lastInChain as Arc).breakToFunctional ? (lastInChain as Arc).start : (lastInChain as Segment).start;

            const lastInChainEndPoint = (lastInChain as Arc).breakToFunctional ? (lastInChain as Arc).end : (lastInChain as Segment).end;

            const shapesBefore: Array<Segment | Arc> = [];
            const shapesAfter: Array<Segment | Arc> = [];
            for (const edgeShape of edgeShapes) {

                const edgeShapeStartPoint = (edgeShape as Arc).breakToFunctional ? (edgeShape as Arc).start : (edgeShape as Segment).start;

                const edgeShapeEndPoint = (edgeShape as Arc).breakToFunctional ? (edgeShape as Arc).end : (edgeShape as Segment).end;

                if (Utils.EQ(lastInChainStartPoint.x, edgeShapeEndPoint.x) && Utils.EQ(lastInChainStartPoint.y, edgeShapeEndPoint.y)) {
                    shapesBefore.push(edgeShape);
                }

                if (Utils.EQ(lastInChainEndPoint.x, edgeShapeStartPoint.x) && Utils.EQ(lastInChainEndPoint.y, edgeShapeStartPoint.y)) {
                    shapesAfter.push(edgeShape);
                }
            }

            // FAIL, should be a closed shape
            //  || shapesBefore.length === 0
            if (shapesBefore.length > 1 || shapesAfter.length > 1 || shapesAfter.length === 0) {
                if (DEBUG_RECTS) {
                    console.log("~~~~ POLY SHAPES BEFORE/AFTER ABORT: " + shapesBefore.length + " ... " + shapesAfter.length);
                }

                chainedEdgeShapes = [];
                // chainedEdgeShapes = edges.map((edge) => edge.shape);
                break;
            }

            const startPoint = (shapesAfter[0] as Arc).breakToFunctional ? (shapesAfter[0] as Arc).start : (shapesAfter[0] as Segment).start;
            const endPoint = (shapesAfter[0] as Arc).breakToFunctional ? (shapesAfter[0] as Arc).end : (shapesAfter[0] as Segment).end;
            if (DEBUG_RECTS) {
                console.log("*** SEGMENT/ARC --- START: (" + startPoint.x + ", " + startPoint.y + ") END: (" + endPoint.x + ", " + endPoint.y + ")");
            }

            edgeShapes.splice(edgeShapes.indexOf(shapesAfter[0]), 1);
            chainedEdgeShapes.push(shapesAfter[0]);

            if (chainedEdgeShapes.length === edges.length) {

                // const edgeShapeStartPoint = (shapesAfter[0] as Arc).breakToFunctional ? (shapesAfter[0] as Arc).start : (shapesAfter[0] as Segment).start;

                const edgeShapeEndPoint = (shapesAfter[0] as Arc).breakToFunctional ? (shapesAfter[0] as Arc).end : (shapesAfter[0] as Segment).end;

                const firstInChainStartPoint = (chainedEdgeShapes[0] as Arc).breakToFunctional ? (chainedEdgeShapes[0] as Arc).start : (chainedEdgeShapes[0] as Segment).start;

                // const firstInChainEndPoint = (chainedEdgeShapes[0] as Arc).breakToFunctional ? (chainedEdgeShapes[0] as Arc).end : (chainedEdgeShapes[0] as Segment).end;

                // FAIL, should be a closed shape
                if (!Utils.EQ(firstInChainStartPoint.x, edgeShapeEndPoint.x) || !Utils.EQ(firstInChainStartPoint.y, edgeShapeEndPoint.y)) {
                    if (DEBUG_RECTS) {
                        console.log("~~~~ POLY SHAPES TAIL/HEAD ABORT");
                    }

                    chainedEdgeShapes = [];
                    // chainedEdgeShapes = edges.map((edge) => edge.shape);
                    break;
                }
            }
        }
        // if (chainedEdgeShapes.length !== edges.length) {
        //     chainedEdgeShapes = edges.map((edge) => edge.shape);
        // }

        let previousSegment: Segment | undefined;
        let previousSmallSegment: Segment | undefined;
        const newEdgeShapes: Array<Segment | Arc> = [];
        let hasChanged = false;

        // guaranteed chain loop
        for (const edgeShape of chainedEdgeShapes) {
            if (!(edgeShape as Arc).breakToFunctional) {
                const segment = edgeShape as Segment;

                const l = segment.length;

                if (DEBUG_RECTS) {
                    console.log("--POLYGON SLOPES: " + previousSegment?.slope + " vs. " + segment.slope);
                }
                if (previousSegment && Utils.EQ(previousSegment.slope, segment.slope)) {
                    if (DEBUG_RECTS) {
                        console.log("--POLYGON SLOPE EQUAL ... merge :)");
                    }
                    hasChanged = true;
                    newEdgeShapes.pop();
                    const seg = new Segment(new Point(previousSegment.start.x, previousSegment.start.y), new Point(segment.end.x, segment.end.y));
                    newEdgeShapes.push(seg);
                    previousSmallSegment = undefined;
                    previousSegment = seg;

                    if (chainedEdgeShapes.indexOf(edgeShape) === chainedEdgeShapes.length - 1 && !(newEdgeShapes[0] as Arc).breakToFunctional && Utils.EQ((newEdgeShapes[0] as Segment).slope, seg.slope)) {
                        if (DEBUG_RECTS) {
                            console.log("--POLYGON SLOPE EQUAL (tail/head link) 1... merge :)");
                        }
                        hasChanged = true;
                        newEdgeShapes.splice(0, 1);
                        const seg2 = new Segment(new Point(newEdgeShapes[0].start.x, newEdgeShapes[0].start.y), new Point(seg.end.x, seg.end.y));
                        newEdgeShapes.push(seg2);
                        previousSmallSegment = undefined;
                        previousSegment = seg2;
                    }
                } else if (newEdgeShapes.length && chainedEdgeShapes.indexOf(edgeShape) === chainedEdgeShapes.length - 1 && !(newEdgeShapes[0] as Arc).breakToFunctional && Utils.EQ((newEdgeShapes[0] as Segment).slope, segment.slope)) {
                    if (DEBUG_RECTS) {
                        console.log("--POLYGON SLOPE EQUAL (tail/head link) 2... merge :)");
                    }
                    hasChanged = true;
                    newEdgeShapes.splice(0, 1);
                    const seg = new Segment(new Point(newEdgeShapes[0].start.x, newEdgeShapes[0].start.y), new Point(segment.end.x, segment.end.y));
                    newEdgeShapes.push(seg);
                    previousSmallSegment = undefined;
                    previousSegment = seg;
                } else if (Utils.LE(l, minLength)) {
                    if (DEBUG_RECTS) {
                        console.log("--POLYGON SEGMENT small LENGTH: " + l + "(" + off + ")");
                    }

                    if (previousSmallSegment) {
                        if (DEBUG_RECTS) {
                            console.log("-->>>> POLYGON SEGMENT small will merge :) ...");
                        }
                        hasChanged = true;
                        newEdgeShapes.pop();
                        const seg = new Segment(new Point(previousSmallSegment.start.x, previousSmallSegment.start.y), new Point(segment.end.x, segment.end.y));
                        newEdgeShapes.push(seg);
                        previousSmallSegment = undefined;
                        previousSegment = seg;
                    } else if (newEdgeShapes.length && chainedEdgeShapes.indexOf(edgeShape) === chainedEdgeShapes.length - 1 && !(newEdgeShapes[0] as Arc).breakToFunctional && Utils.LE((newEdgeShapes[0] as Segment).length, minLength)) {
                        if (DEBUG_RECTS) {
                            console.log("-->>>> POLYGON SEGMENT small (tail/head link) will merge :) ...");
                        }
                        hasChanged = true;
                        newEdgeShapes.splice(0, 1);
                        const seg = new Segment(new Point(newEdgeShapes[0].start.x, newEdgeShapes[0].start.y), new Point(segment.end.x, segment.end.y));;
                        newEdgeShapes.push(seg);
                        previousSmallSegment = undefined;
                        previousSegment = seg;
                    } else {
                        newEdgeShapes.push(segment);
                        previousSmallSegment = segment;
                        previousSegment = segment;
                    }
                } else {
                    if (DEBUG_RECTS) {
                        console.log("--POLYGON SEGMENT ok LENGTH: " + l + "(" + off + ")");
                    }

                    previousSmallSegment = undefined;
                    newEdgeShapes.push(segment);
                    previousSegment = segment;
                }
            } else {
                if (DEBUG_RECTS) {
                    console.log("--POLYGON ARC");
                }
                previousSmallSegment = undefined;
                previousSegment = undefined;
                newEdgeShapes.push(edgeShape as Arc);
            }
        }

        if (hasChanged) {
            if (DEBUG_RECTS) {
                console.log("-->>>> POLYGON face changed :)");
            }
            polygonAccumulator.deleteFace(face);
            polygonAccumulator.addFace(newEdgeShapes);
            // polygonAccumulator.recreateFaces();
        }
    }
};

const addEdgePoints = (polygon: Polygon, offset: number) => {

    const boxes: Box[] = [];
    for (const f of polygon.faces) {
        const face = f as Face;
        for (const edge of face.edges) {
            if (edge.isSegment) {
                const segment = edge.shape as Segment;
                const bStart = new Box(segment.start.x - offset, segment.start.y - offset, segment.start.x + offset * 2, segment.start.y + offset * 2);
                boxes.push(bStart);
                const bEnd = new Box(segment.end.x - offset, segment.end.y - offset, segment.end.x + offset * 2, segment.end.y + offset * 2);
                boxes.push(bEnd);
            } else {
                const arc = edge.shape as Arc;
                const bStart = new Box(arc.start.x - offset, arc.start.y - offset, arc.start.x + offset * 2, arc.start.y + offset * 2);
                boxes.push(bStart);
                const bEnd = new Box(arc.end.x - offset, arc.end.y - offset, arc.end.x + offset * 2, arc.end.y + offset * 2);
                boxes.push(bEnd);
            }
        }
    }
    for (const box of boxes) {
        polygon.addFace(box);
    }
};

const BASE_ORIENTATION = ORIENTATION.CCW; // -1
// const BASE_ORIENTATION_INVERSE = ORIENTATION.CW; // 1

const USE_SEGMENT_JOINS_NOT_ARCS = false;
// import offset from "@flatten-js/polygon-offset";
// Number((x).toPrecision(12))
// https://github.com/alexbol99/flatten-offset/issues/17#issuecomment-1949934684
function arcSE(center: Point, start: Point, end: Point, counterClockwise: boolean): Arc {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DEBUG_RECTS = (window as any).DEBUG_RECTS;

    const startAngle = Number((new Vector(center, start).slope).toPrecision(12));
    let endAngle = Number((new Vector(center, end).slope).toPrecision(12));

    if (Utils.EQ(startAngle, endAngle)) {
        if (DEBUG_RECTS) {
            console.log("--POLYGON ARC ORIENTATION CCW/CW inverse");
        }
        endAngle += 2 * Math.PI;
        counterClockwise = !counterClockwise;
    }

    const r = Number((new Vector(center, start).length).toPrecision(12));;

    return new Arc(center, r, startAngle, endAngle, counterClockwise); // default is CCW / true
}

function offset_(polygon: Polygon, off: number, useSegmentJoinsNotArcs: boolean) {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DEBUG_RECTS = (window as any).DEBUG_RECTS;

    const postponeFinalUnify = off > 0; // Utils.GT(off, 0);
    let polygonAccumulator = postponeFinalUnify ? undefined : polygon.clone();

    for (const f of polygon.faces) {
        const face = f as Face;
        for (const edge of face.edges) {
            if (edge.isSegment) {
                const polygonEdge = new Polygon();

                const segment = edge.shape as Segment;

                const v_seg = new Vector(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
                const v_seg_unit = v_seg.normalize();

                // console.log("--POLYGON SEGMENT LENGTH: " + v_seg.length);

                const absOffset = Math.abs(off);
                const v_left = v_seg_unit.rotate90CCW().multiply(absOffset);
                const v_right = v_seg_unit.rotate90CW().multiply(absOffset);

                const seg_left = segment.translate(v_left).reverse();
                const seg_right = segment.translate(v_right);

                const seg_left_ = new Segment(new Point(Number((seg_left.start.x).toPrecision(12)), Number((seg_left.start.y).toPrecision(12))), new Point(Number((seg_left.end.x).toPrecision(12)), Number((seg_left.end.y).toPrecision(12))));

                const seg_right_ = new Segment(new Point(Number((seg_right.start.x).toPrecision(12)), Number((seg_right.start.y).toPrecision(12))), new Point(Number((seg_right.end.x).toPrecision(12)), Number((seg_right.end.y).toPrecision(12))));

                const orientation = BASE_ORIENTATION === ORIENTATION.CCW ? CCW : CW;
                const cap1 = arcSE(segment.start, seg_left_.end, seg_right_.start, orientation);
                const cap2 = arcSE(segment.end, seg_right_.end, seg_left_.start, orientation);

                const cap1_ =
                    useSegmentJoinsNotArcs
                    ?
                    new Segment(seg_left_.end, seg_right_.start)
                    :
                    cap1;
                    // new Arc(new Point(Number((cap1.center.x).toPrecision(12)), Number((cap1.center.y).toPrecision(12))), Number((cap1.r).toPrecision(12)), Number((cap1.startAngle).toPrecision(12)), Number((cap1.endAngle).toPrecision(12)), cap1.counterClockwise)
                const cap2_ =
                    useSegmentJoinsNotArcs
                    ?
                    new Segment(seg_right_.end, seg_left_.start)
                    :
                    cap2;
                    // new Arc(new Point(Number((cap2.center.x).toPrecision(12)), Number((cap2.center.y).toPrecision(12))), Number((cap2.r).toPrecision(12)), Number((cap2.startAngle).toPrecision(12)), Number((cap2.endAngle).toPrecision(12)), cap2.counterClockwise)

                const face = polygonEdge.addFace([
                    seg_left_,
                    cap1_,
                    seg_right_,
                    cap2_,
                ]);
                if (face.orientation() !== BASE_ORIENTATION) {
                    if (DEBUG_RECTS) {
                        console.log("--POLYGON FACE ORIENTATION CCW/CW reverse() 1");
                    }
                    face.reverse();
                }

                // console.log("--POLYGON FACE AREA: " + face.area());

                if (!(polygonAccumulator || polygonEdge).faces.size) {

                    if (DEBUG_RECTS) {
                        console.log("--################# POLYGON BEFORE unify/substract HAS NO FACES!! " + (polygonAccumulator || polygonEdge).faces.size);
                    }
                }

                if (off > 0) { // Utils.GT(off, 0)
                    polygonAccumulator = polygonAccumulator ? unify(polygonAccumulator, polygonEdge) : polygonEdge;
                } else {
                    polygonAccumulator = polygonAccumulator ? subtract(polygonAccumulator, polygonEdge) : polygonEdge;
                }

                if (!(polygonAccumulator || polygonEdge).faces.size) {
                    if (DEBUG_RECTS) {
                        console.log("--################# POLYGON AFTER unify/substract HAS NO FACES!! " + (polygonAccumulator || polygonEdge).faces.size);
                    }

                    if (!useSegmentJoinsNotArcs) {
                        if (DEBUG_RECTS) {
                            console.log("--##### POLYGON AFTER unify/substract try again without arc, only segment joiners ...");
                        }
                        return offset_(polygon, off, true);
                    }
                } else {
                    if (DEBUG_RECTS) {
                        console.log("--################# POLYGON AFTER unify/substract FACES: " + (polygonAccumulator || polygonEdge).edges.size + " /// " + (polygonAccumulator || polygonEdge).faces.size);
                    }
                }

                for (const f of polygonAccumulator.faces) {
                    const face = f as Face;
                    if (face.edges.length < 4) {
                        if (DEBUG_RECTS) {
                            console.log("-------- POLYGON FACE EDGES not at least 4??!");
                        }
                        if (!useSegmentJoinsNotArcs) {
                            if (DEBUG_RECTS) {
                                console.log("--##### POLYGON AFTER unify/substract try again without arc, only segment joiners ...");
                            }
                            return offset_(polygon, off, true);
                        }
                    }

                    if (face.orientation() !== BASE_ORIENTATION) {
                        if (DEBUG_RECTS) {
                            console.log("-------- POLYGON FACE ORIENTATION");
                        }
                        // face.reverse();
                    }
                }
            } else {
                // offsetEdge = offsetArc(segment, w);
                console.log("!!!!!!!! POLYGON ARC??!");
                // process.exit(0);
                return polygon;
            }
        }
    }

    Array.from((polygonAccumulator ? polygonAccumulator : polygon).faces).forEach((face: Face) => {
        if (face.orientation() !== BASE_ORIENTATION) {
            if (DEBUG_RECTS) {
                console.log("--HIGH WEBVIEW-- removing polygon orientation face / inner hole (offset poly 1))");
            }
            if (polygonAccumulator) {
                polygonAccumulator.deleteFace(face);
                // face.reverse();
            }
        }
    });

    if (polygonAccumulator && postponeFinalUnify) {
        polygonAccumulator = unify(polygonAccumulator, polygon);
    }

    Array.from((polygonAccumulator ? polygonAccumulator : polygon).faces).forEach((face: Face) => {
        if (face.orientation() !== BASE_ORIENTATION) {
            if (DEBUG_RECTS) {
                console.log("--HIGH WEBVIEW-- removing polygon orientation face / inner hole (offset poly 2))");
            }
            if (polygonAccumulator) {
                polygonAccumulator.deleteFace(face);
                // face.reverse();
            }
        }
    });

    if (polygonAccumulator) {
        if (!polygonAccumulator.faces.size) {
            if (DEBUG_RECTS) {
                console.log("--################# POLYGON INTERMEDIARY HAS NO FACES!! " + polygonAccumulator.faces.size);
            }
        }

        cleanupPolygon(polygonAccumulator, off);
    }

    let resPoly = polygonAccumulator ? polygonAccumulator : polygon;

    if (!resPoly.faces.size) {
        if (DEBUG_RECTS) {
            console.log("--################# POLYGON INTERMEDIARY HAS NO FACES!! " + resPoly.faces.size);
        }
        if (polygonAccumulator) {
            if (DEBUG_RECTS) {
                console.log("--################# FALLBACK TO SINGLE FACE POLY (BEFORE SUBSTRACT/UNIFY): " + polygon.faces.size);
            }
            resPoly = polygon;
        }
    }

    return resPoly;
}

function offset(originaPolygon: Polygon, off: number, useSegmentJoinsNotArcs: boolean = USE_SEGMENT_JOINS_NOT_ARCS) {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DEBUG_RECTS = (window as any).DEBUG_RECTS;

    off = Number((off).toPrecision(12));

    if (Utils.EQ_0(off)) {
        return originaPolygon;
    }

    const singleFacePolygons: Polygon[] = [];
    for (const f of originaPolygon.faces) {
        const face = f as Face;
        const poly = new Polygon();
        poly.addFace(face.edges.map((edge) => edge.shape));
        singleFacePolygons.push(poly);
    }

    const singlePolygon = new Polygon();

    for (const polygon of singleFacePolygons) {
        const resPoly = offset_(polygon, off, useSegmentJoinsNotArcs);

        for (const f of resPoly.faces) {
            const face = f as Face;
            singlePolygon.addFace(face.edges.map(((edge) => edge.shape)));
        }
    }

    if (!singlePolygon.faces.size) {
        if (DEBUG_RECTS) {
            console.log("--##### POLYGON OFFSET HAS NO FACES!! " + singlePolygon.faces.size);
        }

        if (!useSegmentJoinsNotArcs) {
            if (DEBUG_RECTS) {
                console.log("--##### POLYGON OFFSET try again without arc, only segment joiners ...");
            }
            return offset(originaPolygon, off, true);
        }
    }

    return singlePolygon;
}

// https://chromium.googlesource.com/devtools/devtools-frontend/+/refs/heads/main/front_end/core/common/ColorUtils.ts
//     const rgb = Math.round(0xffffff * Math.random());
//     // tslint:disable-next-line:no-bitwise
//     const r = rgb >> 16;
//     // tslint:disable-next-line:no-bitwise
//     const g = rgb >> 8 & 255;
//     // tslint:disable-next-line:no-bitwise
//     const b = rgb & 255;
// rgb(${r}, ${g}, ${b});

const DEFAULT_BACKGROUND_COLOR: IColor = {
    blue: 0,
    green: 0,
    red: 255,
};

const _highlights: IHighlight[] = [];

let _drawMargin: boolean | string[] = false;
const drawMargin = (h: IHighlight) => {
    if (Array.isArray(_drawMargin)) {
        if (h.group) {
            return _drawMargin.includes(h.group);
        }
        return false;
    }
    return _drawMargin;
};
export const setDrawMargin = (win: ReadiumElectronWebviewWindow, drawMargin: boolean | string[]) => {
    _drawMargin = drawMargin;
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- _drawMargin: " + JSON.stringify(_drawMargin, null, 4));
    }
    recreateAllHighlightsRaw(win);
};

interface IWithRect {
    rect: IRectSimple;
    scale: number;
    // xOffset: number;
    // yOffset: number;
}
interface IHTMLDivElementWithRect extends HTMLDivElement, IWithRect {
}

interface IWithPolygon {
    polygon: Polygon;
}
const SVG_XML_NAMESPACE = "http://www.w3.org/2000/svg";
// interface ISVGRectElementWithRect extends SVGRectElement, IWithRect {
// }
// interface ISVGLineElementWithRect extends SVGLineElement, IWithRect {
// }
interface ISVGElementWithPolygon extends SVGSVGElement, IWithPolygon {
}

// interface IDocumentBody extends HTMLElement {
//     _CachedBoundingClientRect: DOMRect | undefined;
//     _CachedMargins: IRect | undefined;
// }
export function getBoundingClientRectOfDocumentBody(win: ReadiumElectronWebviewWindow): DOMRect {
    // TODO: does this need to be cached? (performance, notably during mouse hover)
    return win.document.body.getBoundingClientRect();

    // if (!(win.document.body as IDocumentBody)._CachedBoundingClientRect) {
    //     (win.document.body as IDocumentBody)._CachedBoundingClientRect = win.document.body.getBoundingClientRect();
    // }
    // console.log("_CachedBoundingClientRect",
    //     JSON.stringify((win.document.body as IDocumentBody)._CachedBoundingClientRect));
    // return (win.document.body as IDocumentBody)._CachedBoundingClientRect as DOMRect;
}
// export function invalidateBoundingClientRectOfDocumentBody(win: ReadiumElectronWebviewWindow) {
//     (win.document.body as IDocumentBody)._CachedBoundingClientRect = undefined;
// }
// function getBodyMargin(win: ReadiumElectronWebviewWindow): IRect {
//     const bodyStyle = win.getComputedStyle(win.document.body);
//     if (!(win.document.body as IDocumentBody)._CachedMargins) {
//         (win.document.body as IDocumentBody)._CachedMargins = {
//             bottom: parseInt(bodyStyle.marginBottom, 10),
//             height: 0,
//             left: parseInt(bodyStyle.marginLeft, 10),
//             right: parseInt(bodyStyle.marginRight, 10),
//             top: parseInt(bodyStyle.marginTop, 10),
//             width: 0,
//         };
//     }
//     console.log("_CachedMargins",
//         JSON.stringify((win.document.body as IDocumentBody)._CachedMargins));
//     return (win.document.body as IDocumentBody)._CachedMargins as IRect;
// }

function processMouseEvent(win: ReadiumElectronWebviewWindow, ev: MouseEvent) {

    // const highlightsContainer = documant.getElementById(`${ID_HIGHLIGHTS_CONTAINER}`);
    if (!_highlightsContainer) {
        return;
    }

    const isMouseMove = ev.type === "mousemove";
    if (isMouseMove) {
        // no hit testing during user selection drag
        if (ev.buttons > 0) {
            return;
        }

        if (!_highlights.length) {
            return;
        }
    }

    const documant = win.document;
    const scrollElement = getScrollingElement(documant);

    // relative to fixed window top-left corner
    // (unlike pageX/Y which is relative to top-left rendered content area, subject to scrolling)
    const x = ev.clientX;
    const y = ev.clientY;

    const paginated = isPaginated(documant);

    // COSTLY! TODO: cache DOMRect
    const bodyRect = getBoundingClientRectOfDocumentBody(win);

    const xOffset = paginated ? (-scrollElement.scrollLeft) : bodyRect.left;
    const yOffset = paginated ? (-scrollElement.scrollTop) : bodyRect.top;

    const scale = 1 / ((win.READIUM2 && win.READIUM2.isFixedLayout) ? win.READIUM2.fxlViewportScale : 1);

    let hit = false;
    let foundHighlight: IHighlight | undefined;
    let foundElement: IHTMLDivElementWithRect | undefined;
    // for (const highlight of _highlights) {
    for (let i = _highlights.length - 1; i >= 0; i--) {
        const highlight = _highlights[i];

        let highlightParent = documant.getElementById(`${highlight.id}`);
        if (!highlightParent) { // ??!!
            highlightParent = _highlightsContainer.querySelector(`#${highlight.id}`); // .${CLASS_HIGHLIGHT_CONTAINER}
        }
        if (!highlightParent) { // what?
            continue;
        }

        let highlightFragment = highlightParent.firstElementChild;
        while (highlightFragment) {
            if (highlightFragment.namespaceURI === SVG_XML_NAMESPACE) {

                const svg = highlightFragment as ISVGElementWithPolygon;
                hit = svg.polygon.contains(new Point((x - xOffset) * scale, (y - yOffset) * scale));
                if (hit) {
                    break;
                }
            }

            highlightFragment = highlightFragment.nextElementSibling;
        }

        if (hit) {
            foundHighlight = highlight;
            foundElement = highlightParent as IHTMLDivElementWithRect;
            break;
        }
    }

    let highlightContainer = _highlightsContainer.firstElementChild;
    while (highlightContainer) {
        if (!foundElement || foundElement !== highlightContainer) {
            highlightContainer.classList.remove(CLASS_HIGHLIGHT_HOVER);
        }

        // const id = highlightContainer.id || highlightContainer.getAttribute("id");
        // const highlight = id ? _highlights.find((h) => h.id === id) : undefined;
        // const drawUnderline = highlight?.drawType === HighlightDrawTypeUnderline;
        // const drawStrikeThrough = highlight?.drawType === HighlightDrawTypeStrikethrough;
        // const doDrawMargin = highlight ? drawMargin(highlight) : false;

        highlightContainer = highlightContainer.nextElementSibling;
    }

    if (!hit) { // !foundHighlight || !foundElement

        // documant.documentElement.classList.remove(CLASS_HIGHLIGHT_CURSOR1);
        documant.documentElement.classList.remove(CLASS_HIGHLIGHT_CURSOR2);
        return;
    }

    if (foundElement && foundHighlight?.pointerInteraction) {

        if (isMouseMove) {
            foundElement.classList.add(CLASS_HIGHLIGHT_HOVER);

            // const doDrawMargin = drawMargin(foundHighlight);
            // documant.documentElement.classList.add(doDrawMargin ? CLASS_HIGHLIGHT_CURSOR1 : CLASS_HIGHLIGHT_CURSOR2);
            documant.documentElement.classList.add(CLASS_HIGHLIGHT_CURSOR2);

        } else if (ev.type === "mouseup" || ev.type === "click") {
            // documant.documentElement.classList.remove(CLASS_HIGHLIGHT_CURSOR1);
            documant.documentElement.classList.remove(CLASS_HIGHLIGHT_CURSOR2);

            ev.preventDefault();
            ev.stopPropagation();

            const payload: IEventPayload_R2_EVENT_HIGHLIGHT_CLICK = {
                highlight: foundHighlight,
                event: {
                    type: ev.type,
                    button: ev.button,
                    alt: ev.altKey,
                    shift: ev.shiftKey,
                    ctrl: ev.ctrlKey,
                    meta: ev.metaKey,
                    x: ev.clientX,
                    y: ev.clientY,
                },
            };
            ipcRenderer.sendToHost(R2_EVENT_HIGHLIGHT_CLICK, payload);
        }
    }
}

let lastMouseDownX = -1;
let lastMouseDownY = -1;
let bodyEventListenersSet = false;
let _highlightsContainer: HTMLElement | null;
function ensureHighlightsContainer(win: ReadiumElectronWebviewWindow): HTMLElement {
    const documant = win.document;

    if (!_highlightsContainer) {

        // Note that legacy ResizeSensor sets body position to "relative" (default static).
        // Also note that ReadiumCSS default to (via stylesheet :root):
        // documant.documentElement.style.position = "relative";
        // see styles.js (static CSS injection):
        // documant.documentElement.style.setProperty("height", "100vh", "important");
        // documant.body.style.position = "relative";
        // documant.body.style.setProperty("position", "relative", "important");
        // documant.body.style.height = "inherit";
        // https://github.com/edrlab/thorium-reader/issues/1658

        if (!bodyEventListenersSet) {
            bodyEventListenersSet = true;

            // reminder: mouseenter/mouseleave do not bubble, so no event delegation
            // documant.body.addEventListener("click", (ev: MouseEvent) => {
            //     processMouseEvent(win, ev);
            // }, false);
            documant.body.addEventListener("mousedown", (ev: MouseEvent) => {
                lastMouseDownX = ev.clientX;
                lastMouseDownY = ev.clientY;
            }, false);
            documant.body.addEventListener("mouseup", (ev: MouseEvent) => {
                if ((Math.abs(lastMouseDownX - ev.clientX) < 3) &&
                    (Math.abs(lastMouseDownY - ev.clientY) < 3)) {
                    processMouseEvent(win, ev);
                }
            }, false);
            documant.body.addEventListener("mousemove", (ev: MouseEvent) => {
                processMouseEvent(win, ev);
            }, false);
        }

        _highlightsContainer = documant.createElement("div");
        _highlightsContainer.setAttribute("id", ID_HIGHLIGHTS_CONTAINER);
        _highlightsContainer.setAttribute("class", CLASS_HIGHLIGHT_COMMON);
        _highlightsContainer.setAttribute("style",
            "width: auto !important; " +
            "height: auto !important; ");
        documant.body.append(_highlightsContainer);
    }
    return _highlightsContainer;
}

export function hideAllhighlights(_documant: Document) {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- hideAllhighlights: " + _highlights.length);
    }

    if (ENABLE_CSS_HIGHLIGHTS && CSS.highlights) {
        CSS.highlights.clear();
    }

    if (_highlightsContainer) {
        _highlightsContainer.remove();
        _highlightsContainer = null;
        // ensureHighlightsContainer(documant); LAZY
    }
}

export function destroyAllhighlights(documant: Document) {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- destroyAllhighlights: " + _highlights.length);
    }
    hideAllhighlights(documant);
    _highlights.splice(0, _highlights.length);
}

export function destroyHighlight(documant: Document, id: string) {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- destroyHighlight: " + id + " ... " + _highlights.length);
    }
    let i = -1;
    const highlight = _highlights.find((h, j) => {
        i = j;
        return h.id === id;
    });
    if (highlight && i >= 0 && i < _highlights.length) {
        _highlights.splice(i, 1);
    }

    const highlightContainer = documant.getElementById(id);
    if (highlightContainer) {
        highlightContainer.remove();
    }

    if (highlight && ENABLE_CSS_HIGHLIGHTS && CSS.highlights && highlight.range && highlight.color && (!highlight.drawType || highlight.drawType === HighlightDrawTypeBackground)) {
        const strRGB = `R${highlight.color.red}G${highlight.color.green}B${highlight.color.blue}`;
        const cssHighlightID = `highlight_${strRGB}`;

        const cssHighlight = CSS.highlights.get(cssHighlightID);
        if (cssHighlight && cssHighlight.has(highlight.range)) {
            cssHighlight.delete(highlight.range);
        }
    }
}

export function destroyHighlightsGroup(documant: Document, group: string) {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- destroyHighlightsGroup: " + group + " ... " + _highlights.length);
    }
    while (true) {
        let i = -1;
        const highlight = _highlights.find((h, j) => {
            i = j;
            return h.group === group;
        });
        if (highlight) {
            if (i >= 0 && i < _highlights.length) {
                _highlights.splice(i, 1);
            }

            const highlightContainer = documant.getElementById(highlight.id);
            if (highlightContainer) {
                highlightContainer.remove();
            }

            if (ENABLE_CSS_HIGHLIGHTS && CSS.highlights && highlight.range && highlight.color && (!highlight.drawType || highlight.drawType === HighlightDrawTypeBackground)) {
                const strRGB = `R${highlight.color.red}G${highlight.color.green}B${highlight.color.blue}`;
                const cssHighlightID = `highlight_${strRGB}`;

                const cssHighlight = CSS.highlights.get(cssHighlightID);
                if (cssHighlight && cssHighlight.has(highlight.range)) {
                    cssHighlight.delete(highlight.range);
                }
            }
        } else {
            break;
        }
    }
}

export function recreateAllHighlightsRaw(win: ReadiumElectronWebviewWindow, highlights?: IHighlight[]) {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- recreateAllHighlightsRaw: " + _highlights.length + " ==> " + highlights?.length);
    }

    const documant = win.document;

    if (highlights?.length) {
        if (_highlights.length) {
            if (IS_DEV) {
                console.log("--HIGH WEBVIEW-- recreateAllHighlightsRaw DESTROY OLD BEFORE RESTORE BACKUP: " + _highlights.length + " ==> " + highlights.length);
            }
            destroyAllhighlights(documant);
        }
        if (IS_DEV) {
            console.log("--HIGH WEBVIEW-- recreateAllHighlightsRaw RESTORE BACKUP: " + _highlights.length + " ==> " + highlights.length);
        }
        _highlights.push(...highlights);
    }

    if (!_highlights.length) {
        return;
    }

    if (!documant.body) {
        if (IS_DEV) {
            console.log("--HIGH WEBVIEW-- NO BODY?! (retrying...): " + _highlights.length);
        }
        recreateAllHighlightsDebounced(win);
        return;
    }

    hideAllhighlights(documant);

    const bodyRect = getBoundingClientRectOfDocumentBody(win);
    const bodyComputedStyle = win.getComputedStyle(documant.body);

    const docFrag = documant.createDocumentFragment();
    for (const highlight of _highlights) {
        const div = createHighlightDom(win, highlight, bodyRect, bodyComputedStyle);
        if (div) {
            docFrag.append(div);
        }
    }

    const highlightsContainer = ensureHighlightsContainer(win);
    highlightsContainer.append(docFrag);
}

export const recreateAllHighlightsDebounced = debounce((win: ReadiumElectronWebviewWindow) => {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- recreateAllHighlightsDebounced: " + _highlights.length);
    }
    recreateAllHighlightsRaw(win);
}, 500);

export function recreateAllHighlights(win: ReadiumElectronWebviewWindow) {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- recreateAllHighlights: " + _highlights.length);
    }
    hideAllhighlights(win.document);
    recreateAllHighlightsDebounced(win);
}

export function createHighlights(
    win: ReadiumElectronWebviewWindow,
    highDefs: IHighlightDefinition[],
    pointerInteraction: boolean): Array<IHighlight | null> {
    if (IS_DEV) {
        console.log("--HIGH WEBVIEW-- createHighlights: " + highDefs.length + " ... " + _highlights.length);
    }

    const documant = win.document;
    const highlights: Array<IHighlight | null> = [];

    const bodyRect = getBoundingClientRectOfDocumentBody(win);
    const bodyComputedStyle = win.getComputedStyle(documant.body);

    const docFrag = documant.createDocumentFragment();
    for (const highDef of highDefs) {
        if (!highDef.selectionInfo && !highDef.range) {
            highlights.push(null);
            continue;
        }
        const [high, div] = createHighlight(
            win,
            highDef.selectionInfo,
            highDef.range,
            highDef.color,
            pointerInteraction,
            highDef.drawType,
            highDef.expand,
            highDef.group,
            bodyRect,
            bodyComputedStyle);
        highlights.push(high);

        if (div) {
            docFrag.append(div);
        }
    }

    const highlightsContainer = ensureHighlightsContainer(win);
    highlightsContainer.append(docFrag);

    return highlights;
}

const computeCFI = (node: Node): string | undefined => {

    if (node.nodeType !== Node.ELEMENT_NODE) {
        if (node.parentNode) {
            return computeCFI(node.parentNode);
        }
        return undefined;
    }

    let cfi = "";

    let currentElement = node as Element;
    while (currentElement.parentNode && currentElement.parentNode.nodeType === Node.ELEMENT_NODE) {
        const currentElementParentChildren = (currentElement.parentNode as Element).children;
        let currentElementIndex = -1;
        for (let i = 0; i < currentElementParentChildren.length; i++) {
            if (currentElement === currentElementParentChildren[i]) {
                currentElementIndex = i;
                break;
            }
        }
        if (currentElementIndex >= 0) {
            const cfiIndex = (currentElementIndex + 1) * 2;
            cfi = cfiIndex +
                (currentElement.id ? ("[" + currentElement.id + "]") : "") +
                (cfi.length ? ("/" + cfi) : "");
        }
        currentElement = currentElement.parentNode as Element;
    }

    return "/" + cfi;
};

export function createHighlight(
    win: ReadiumElectronWebviewWindow,
    selectionInfo: ISelectionInfo | undefined,
    range: Range | undefined,
    color: IColor | undefined,
    pointerInteraction: boolean,
    drawType: number | undefined,
    expand: number | undefined,
    group: string | undefined,
    bodyRect: DOMRect,
    bodyComputedStyle: CSSStyleDeclaration): [IHighlight, HTMLDivElement | null] {

    // tslint:disable-next-line:no-string-literal
    // console.log("Chromium: " + process.versions["chrome"]);

    // range = range ? range : selectionInfo ? convertRangeInfo(win.document, selectionInfo.rangeInfo) : undefined;

    const uniqueStr = selectionInfo ? `${selectionInfo.rangeInfo.startContainerElementCssSelector}${selectionInfo.rangeInfo.startContainerChildTextNodeIndex}${selectionInfo.rangeInfo.startOffset}${selectionInfo.rangeInfo.endContainerElementCssSelector}${selectionInfo.rangeInfo.endContainerChildTextNodeIndex}${selectionInfo.rangeInfo.endOffset}` : range ? `${range.startOffset}-${range.endOffset}-${computeCFI(range.startContainer)}-${computeCFI(range.endContainer)}` : "_RANGE_"; // ${selectionInfo.rangeInfo.cfi} useless

    // console.log("RANGE uniqueStr: " + uniqueStr + " (( " + range?.toString());

    // const unique = Buffer.from(JSON.stringify(selectionInfo.rangeInfo, null, "")).toString("base64");
    // const unique = Buffer.from(uniqueStr).toString("base64");
    // const id = "R2_HIGHLIGHT_" + unique.replace(/\+/, "_").replace(/=/, "-").replace(/\//, ".");
    const checkSum = crypto.createHash("sha1"); // sha256 slow
    checkSum.update(uniqueStr);
    const shaHex = checkSum.digest("hex");
    const idBase = "R2_HIGHLIGHT_" + shaHex;
    let id = idBase;
    let idIdx = 0;
    while (
        _highlights.find((h) => h.id === id) ||
        win.document.getElementById(id)) {

        if (IS_DEV) {
            console.log("HIGHLIGHT ID already exists, increment: " + uniqueStr + " ==> " + id);
        }
        id = `${idBase}_${idIdx++}`;
    }

    const highlight: IHighlight = {
        color: color ? color : DEFAULT_BACKGROUND_COLOR,
        drawType,
        expand,
        id,
        pointerInteraction,
        selectionInfo,
        range,
        group,
    };
    _highlights.push(highlight);

    const div = createHighlightDom(win, highlight, bodyRect, bodyComputedStyle);
    return [highlight, div];
}

const JAPANESE_RUBY_TO_SKIP = ["rt", "rp"];
function createHighlightDom(
    win: ReadiumElectronWebviewWindow,
    highlight: IHighlight,
    bodyRect: DOMRect,
    bodyComputedStyle: CSSStyleDeclaration): HTMLDivElement | null {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DEBUG_RECTS = (window as any).DEBUG_RECTS;

    const documant = win.document;
    const scrollElement = getScrollingElement(documant);

    const range = highlight.range ? highlight.range : highlight.selectionInfo ? convertRangeInfo(documant, highlight.selectionInfo.rangeInfo) : undefined;
    if (!range) {
        return null;
    }

    const drawBackground = !highlight.drawType || highlight.drawType === HighlightDrawTypeBackground;
    const drawUnderline = highlight.drawType === HighlightDrawTypeUnderline;
    const drawStrikeThrough = highlight.drawType === HighlightDrawTypeStrikethrough;
    const drawOutline = highlight.drawType === HighlightDrawTypeOutline;

    const paginated = isPaginated(documant);

    const rtl = isRTL();
    const vertical = isVerticalWritingMode();

    const doDrawMargin = drawMargin(highlight);

    const isCssHighlight = ENABLE_CSS_HIGHLIGHTS && CSS.highlights && !doDrawMargin && highlight.color && drawBackground;

    if (isCssHighlight) {
        const strRGB = `R${highlight.color.red}G${highlight.color.green}B${highlight.color.blue}`;
        const cssHighlightID = `highlight_${strRGB}`;
        const styleElement = win.document.getElementById("Readium2-" + strRGB);
        if (!styleElement) {
            appendCSSInline(win.document, strRGB,
// :root > body#body, :root[style] > body#body { background-color: magenta !important; }
// text-decoration
// text-shadow
// -webkit-text-stroke-color
// -webkit-text-fill-color
// -webkit-text-stroke-width
`
/*
https://lea.verou.me/blog/2024/contrast-color
https://blackorwhite.lloydk.ca
*/

@property --${strRGB} {
syntax: "<color>";
inherits: true;
initial-value: transparent;
}

::highlight(${cssHighlightID}) {
    --${strRGB}: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue});
    background-color: var(--${strRGB});

    color: red;
    text-shadow: 0 0 .05em black, 0 0 .05em black, 0 0 .05em black, 0 0 .05em black;
}

/* @supports (color: oklch(from color-mix(in oklch, red, tan) l c h)) { */
@supports (color: oklch(from red l c h)) {

    ::highlight(${cssHighlightID}) {
        --${strRGB}: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue});
        background-color: var(--${strRGB});

        --l-threshold: 0.7;
        --l: clamp(0, (var(--l-threshold, 0.623) / l - 1) * infinity, 1);

        -y-threshold: 0.36;
        --y: clamp(0, (var(--y-threshold) / y - 1) * infinity, 1);

        color: oklch(from var(--${strRGB}) var(--l) 0 h);
        /*
        color: color(from var(--${strRGB}) xyz-d65 var(--y) var(--y) var(--y));
        */

        text-shadow: none;
    }
}

@supports (color: contrast-color(red)) {

    ::highlight(${cssHighlightID}) {
        --${strRGB}: rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue});
        background-color: var(--${strRGB});

        color: contrast-color(var(--${strRGB}));
        text-shadow: none;
    }
}
`);
        }

        let cssHighlight = CSS.highlights.get(cssHighlightID);
        if (!cssHighlight) {
            cssHighlight = new Highlight();
            CSS.highlights.set(cssHighlightID, cssHighlight);
        }

        cssHighlight.add(range);
    }

    // checkRangeFix(documant);

    // const highlightsContainer = ensureHighlightsContainer(win);

    const highlightParent = documant.createElement("div") as IHTMLDivElementWithRect;
    highlightParent.setAttribute("id", highlight.id);
    highlightParent.setAttribute("class", `${CLASS_HIGHLIGHT_CONTAINER} ${CLASS_HIGHLIGHT_COMMON}`);
    highlightParent.setAttribute("data-type", `${highlight.drawType || HighlightDrawTypeBackground}`);
    if (highlight.group) {
        highlightParent.setAttribute("data-group", highlight.group);
    }
    if (doDrawMargin) {
        // highlightParent.setAttribute("data-margin", "true");
        highlightParent.classList.add(CLASS_HIGHLIGHT_MARGIN);
    }

    // const styleAttr = win.document.documentElement.getAttribute("style");
    // const isNight = styleAttr ? styleAttr.indexOf("readium-night-on") > 0 : false;
    // const isSepia = styleAttr ? styleAttr.indexOf("readium-sepia-on") > 0 : false;

    // export const HighlightDrawTypeBackground = 0;
    // export const HighlightDrawTypeUnderline = 1;
    // export const HighlightDrawTypeStrikethrough = 2;
    // export const HighlightDrawTypeOutline = 3;
    if (!highlight.drawType || highlight.drawType === HighlightDrawTypeBackground) {
        // highlightParent.style.setProperty(
        //     "mix-blend-mode",
        //     // isNight ? "hard-light" :
        //     "multiply",
        //     "important");
        // highlightParent.style.setProperty(
        //     "z-index",
        //     "-1");
        highlightParent.classList.add(CLASS_HIGHLIGHT_BEHIND);
    }

    // const docStyle = (documant.defaultView as Window).getComputedStyle(documant.documentElement);
    // const bodyStyle = (documant.defaultView as Window).getComputedStyle(documant.body);
    // const marginLeft = bodyStyle.getPropertyValue("margin-left");
    // console.log("marginLeft: " + marginLeft);
    // const marginTop = bodyStyle.getPropertyValue("margin-top");
    // console.log("marginTop: " + marginTop);

    // console.log("==== bodyRect:");
    // console.log("width: " + bodyRect.width);
    // console.log("height: " + bodyRect.height);
    // console.log("top: " + bodyRect.top);
    // console.log("bottom: " + bodyRect.bottom);
    // console.log("left: " + bodyRect.left);
    // console.log("right: " + bodyRect.right);

    // const xOffset = paginated ? (bodyRect.left - parseInt(marginLeft, 10)) : bodyRect.left;
    // const yOffset = paginated ? (bodyRect.top - parseInt(marginTop, 10)) : bodyRect.top;

    const xOffset = paginated ? (-scrollElement.scrollLeft) : bodyRect.left;
    const yOffset = paginated ? (-scrollElement.scrollTop) : bodyRect.top;

    const scale = 1 / ((win.READIUM2 && win.READIUM2.isFixedLayout) ? win.READIUM2.fxlViewportScale : 1);
    // const scale = 1;

    // console.log("scrollElement.scrollLeft: " + scrollElement.scrollLeft);
    // console.log("scrollElement.scrollTop: " + scrollElement.scrollTop);

    const doNotMergeHorizontallyAlignedRects = drawUnderline || drawStrikeThrough;

    let clientRects: IRect[] | undefined;

    const rangeClientRects = DOMRectListToArray(range.getClientRects());

    if (doNotMergeHorizontallyAlignedRects) {
        // non-solid highlight (underline or strikethrough), cannot merge and reduce/simplify client rectangles much due to importance of line-level decoration (must preserve horizontal/vertical line heights)

        // Japanese Ruby ... ugly hack, TODO extract logic elsewhere!? TODO only TTS? (annotations and search could be problematic if only Ruby RT/RP match? ... but search already excludes Ruby, and mouse text selection makes it hard/impossible to select Ruby upperscript, so...)
        // highlight.group === "tts" ? JAPANESE_RUBY_TO_SKIP : undefined
        const textClientRects = getTextClientRects(range, JAPANESE_RUBY_TO_SKIP);

        const textReducedClientRects = getClientRectsNoOverlap(textClientRects, true, vertical, highlight.expand ? highlight.expand : 0);

        clientRects = (DEBUG_RECTS && drawStrikeThrough) ? textClientRects : textReducedClientRects;

        // const rangeReducedClientRects = getClientRectsNoOverlap(rangeClientRects, false, vertical, 0);

        // // const rangeUnionPolygon = rangeReducedClientRects.reduce((previous, current) => unify(previous, new Polygon(new Box(current.left, current.top, current.left + current.width, current.top + current.height))), new Polygon());

        // // Array.from(rangeUnionPolygon.faces).forEach((face: Face) => {
        // //     if (face.orientation() !== BASE_ORIENTATION) {
        // //         if (DEBUG_RECTS) {
        // //             console.log("--HIGH WEBVIEW-- removing polygon orientation face / inner hole (text range))");
        // //         }
        // //         polygonCountourUnionPoly.deleteFace(face);
        // //     }
        // // });

        // const textReducedClientRectsToKeep: IRect[] = [];
        // textReducedClientRectsToKeep.push(...textReducedClientRects);

        // for (const rect of textReducedClientRects) {
        //     console.log("__RECT__ text :: " + `TOP:${rect.top} BOTTOM:${rect.bottom} LEFT:${rect.left} RIGHT:${rect.right} WIDTH:${rect.width} HEIGHT:${rect.height}`);

        //     let intersections: IRect[] | undefined;
        //     for (const rectRange of rangeReducedClientRects) {
        //         console.log("__RECT__ range :: " + `TOP:${rect.top} BOTTOM:${rect.bottom} LEFT:${rect.left} RIGHT:${rect.right} WIDTH:${rect.width} HEIGHT:${rect.height}`);
        //         const rectIntersection = rectIntersect(rect, rectRange);
        //         const hasIntersection = rectIntersection.width > 0 || rectIntersection.height > 0;
        //         if (!hasIntersection) {
        //             console.log("__RECT__ no intersect");
        //             continue;
        //         }
        //         console.log("__RECT__ intersect :: " + `TOP:${rectIntersection.top} BOTTOM:${rectIntersection.bottom} LEFT:${rectIntersection.left} RIGHT:${rectIntersection.right} WIDTH:${rectIntersection.width} HEIGHT:${rectIntersection.height}`);
        //         if (!intersections) {
        //             intersections = [];
        //         }
        //         intersections.push(rectIntersection);
        //     }

        //     if (!intersections?.length) {
        //         console.log("__RECT__ zero intersect, eject rect");
        //         textReducedClientRectsToKeep.splice(textReducedClientRectsToKeep.indexOf(rect), 1);
        //     } else {
        //         const intersectionsBoundingBox = intersections.reduce((previous, current) => {
        //             if (current === previous) {
        //                 return current;
        //             }
        //             return getBoundingRect(previous, current);
        //         }, intersections[0]);

        //         console.log("__RECT__ intersect bounds :: " + `TOP:${intersectionsBoundingBox.top} BOTTOM:${intersectionsBoundingBox.bottom} LEFT:${intersectionsBoundingBox.left} RIGHT:${intersectionsBoundingBox.right} WIDTH:${intersectionsBoundingBox.width} HEIGHT:${intersectionsBoundingBox.height}`);

        //         if (!rectSame(intersectionsBoundingBox, rect, 2)) {
        //             console.log("__RECT__ rect different than intersect bounds, replace");
        //             textReducedClientRectsToKeep.splice(textReducedClientRectsToKeep.indexOf(rect), 1, intersectionsBoundingBox);
        //         }
        //     }

        //     // const rectPolygon = new Polygon(new Box(rect.left, rect.top, rect.left + rect.width, rect.top + rect.height));

        //     // const poly = intersect(rangeUnionPolygon, rectPolygon);
        //     // const b = poly.box; // shortcut, but we could check polygon faces too

        //     // if (rect.left !== b.xmin || rect.top !== b.ymin || rect.right !== b.xmax || rect.bottom !== b.ymax) {
        //     //     console.log("__RECT__ before" + `TOP:${rect.top} BOTTOM:${rect.bottom} LEFT:${rect.left} RIGHT:${rect.right} WIDTH:${rect.width} HEIGHT:${rect.height}`);

        //     //     rect.left = b.xmin;
        //     //     rect.top = b.ymin;
        //     //     rect.right = b.xmax;
        //     //     rect.bottom = b.ymax;
        //     //     rect.width = b.width;
        //     //     rect.height = b.height;

        //     //     console.log("__RECT__ after" + `TOP:${rect.top} BOTTOM:${rect.bottom} LEFT:${rect.left} RIGHT:${rect.right} WIDTH:${rect.width} HEIGHT:${rect.height}`);
        //     // }
        // }

        // console.log("__RECT__ :: " + textClientRects.length + " ===> " + textReducedClientRectsToKeep.length);

        // clientRects = (DEBUG_RECTS && drawStrikeThrough) ? textClientRects : textReducedClientRectsToKeep;
    } else {
        // solid highlight, can merge and reduce/simplify client rectangles as much as possible
        clientRects = getClientRectsNoOverlap(rangeClientRects, false, vertical, highlight.expand ? highlight.expand : 0);
    }

    // let highlightAreaSVGDocFrag: DocumentFragment | undefined;
    // const roundedCorner = 3;

    const underlineThickness = 3;
    const strikeThroughLineThickness = 4;

    // const rangeBoundingClientRect = range.getBoundingClientRect();

    const bodyWidth = parseInt(bodyComputedStyle.width, 10);
    const paginatedTwo = paginated && isTwoPageSpread();
    const paginatedWidth = scrollElement.clientWidth / (paginatedTwo ? 2 : 1);
    const paginatedOffset = (paginatedWidth - bodyWidth) / 2 + parseInt(bodyComputedStyle.paddingLeft, 10);

    const gap = 2;
    const gapX = ((drawOutline || drawBackground) ? gap : 0);

    const boxesNoGapExpanded = [];
    const boxesGapExpanded = [];

    for (const clientRect of clientRects) {

        const rect = {
            height: clientRect.height,
            left: clientRect.left - xOffset,
            top: clientRect.top - yOffset,
            width: clientRect.width,
        };
        const w = rect.width * scale;
        const h = rect.height * scale;
        const x = rect.left * scale;
        const y = rect.top * scale;

        boxesGapExpanded.push(new Box(
            Number((x - gap).toPrecision(12)),
            Number((y - gap).toPrecision(12)),
            Number((x + w + gap).toPrecision(12)),
            Number((y + h + gap).toPrecision(12)),
        ));

        // boxesNoGapExpanded.push(new Box(
        //     Number((x).toPrecision(12)),
        //     Number((y).toPrecision(12)),
        //     Number((x + w).toPrecision(12)),
        //     Number((y + h).toPrecision(12)),
        // ));

        if (drawStrikeThrough) {

            const thickness = DEBUG_RECTS ? (vertical ? rect.width : rect.height) : strikeThroughLineThickness;
            const ww = (vertical ? thickness : rect.width) * scale;
            const hh = (vertical ? rect.height : thickness) * scale;
            const xx =
            (
            vertical
            ?
            (
                DEBUG_RECTS
                ?
                rect.left
                :
                (rect.left + (rect.width / 2) - (thickness / 2))
            )
            :
            rect.left
            ) * scale;

            const yy =
            (
            vertical
            ?
            rect.top
            :
            (
                DEBUG_RECTS
                ?
                rect.top
                :
                (rect.top + (rect.height / 2) - (thickness / 2))
            )
            ) * scale;

            boxesNoGapExpanded.push(new Box(
                Number((xx - gapX).toPrecision(12)),
                Number((yy - gapX).toPrecision(12)),
                Number((xx + ww + gapX).toPrecision(12)),
                Number((yy + hh + gapX).toPrecision(12)),
            ));

        } else { // drawStrikeThrough

            const thickness = DEBUG_RECTS ? (vertical ? rect.width : rect.height) : underlineThickness;
            if (drawUnderline) {
                const ww = (vertical ? thickness : rect.width) * scale;
                const hh = (vertical ? rect.height : thickness) * scale;
                const xx =
                (
                vertical
                ?
                (
                    DEBUG_RECTS
                    ?
                    rect.left
                    :
                    (rect.left - (thickness / 2))
                )
                :
                rect.left
                ) * scale;

                const yy =
                (
                vertical
                ?
                rect.top
                :
                (
                    DEBUG_RECTS
                    ?
                    rect.top
                    :
                    (rect.top + rect.height - (thickness / 2))
                )
                ) * scale;

                boxesNoGapExpanded.push(new Box(
                    Number((xx - gapX).toPrecision(12)),
                    Number((yy - gapX).toPrecision(12)),
                    Number((xx + ww + gapX).toPrecision(12)),
                    Number((yy + hh + gapX).toPrecision(12)),
                ));
            } else {
                boxesNoGapExpanded.push(new Box(
                    Number((x - gapX).toPrecision(12)),
                    Number((y - gapX).toPrecision(12)),
                    Number((x + w + gapX).toPrecision(12)),
                    Number((y + h + gapX).toPrecision(12)),
                ));
            }
        }
    }

    const polygonCountourUnionPoly = boxesGapExpanded.reduce((previousPolygon, currentBox) => {
        const p = new Polygon();
        const f = p.addFace(currentBox);
        if (f.orientation() !== BASE_ORIENTATION) {
            console.log("--POLYGON FACE ORIENTATION CCW/CW reverse() 2");
            f.reverse();
        }
        return unify(previousPolygon, p);
    }, new Polygon());

    Array.from(polygonCountourUnionPoly.faces).forEach((face: Face) => {
        if (face.orientation() !== BASE_ORIENTATION) {
            if (DEBUG_RECTS) {
                console.log("--HIGH WEBVIEW-- removing polygon orientation face / inner hole (contour))");
            }
            polygonCountourUnionPoly.deleteFace(face);
        }
    });
    cleanupPolygon(polygonCountourUnionPoly, gap);

    let polygonSurface: Polygon | Polygon[] | undefined;
    if (doNotMergeHorizontallyAlignedRects) {
        const singleSVGPath = !DEBUG_RECTS;
        if (singleSVGPath) {
            polygonSurface = new Polygon();
            for (const box of boxesNoGapExpanded) {
                const f = polygonSurface.addFace(box);
                if (f.orientation() !== BASE_ORIENTATION) {
                    console.log("--POLYGON FACE ORIENTATION CCW/CW reverse() 3");
                    f.reverse();
                }
            }
        } else {
            polygonSurface = [];
            for (const box of boxesNoGapExpanded) {
                const poly = new Polygon();
                const f = poly.addFace(box);
                if (f.orientation() !== BASE_ORIENTATION) {
                    console.log("--POLYGON FACE ORIENTATION CCW/CW reverse() 4");
                    f.reverse();
                }
                polygonSurface.push(poly);
            }
        }
    } else {
        polygonSurface = boxesNoGapExpanded.reduce((previousPolygon, currentBox) => {
            const p = new Polygon();
            const f = p.addFace(currentBox);
            if (f.orientation() !== BASE_ORIENTATION) {
                console.log("--POLYGON FACE ORIENTATION CCW/CW reverse() 5");
                f.reverse();
            }
            return unify(previousPolygon, p);
        }, new Polygon());

        Array.from(polygonSurface.faces).forEach((face: Face) => {
            if (face.orientation() !== BASE_ORIENTATION) {
                if (DEBUG_RECTS) {
                    console.log("--HIGH WEBVIEW-- removing polygon orientation face / inner hole (surface))");
                }
                (polygonSurface as Polygon).deleteFace(face);
            }
        });

        if (drawOutline || drawBackground) {

            if (DEBUG_RECTS) {
                console.log("--==========--==========--==========--==========--==========--==========");
                console.log("--POLY FACES BEFORE ...");
            }
            for (const f of polygonSurface.faces) {
                const face = f as Face;
                if (DEBUG_RECTS) {
                    console.log("--................--................--................");
                    console.log("--POLY FACE: " + (face.orientation() === ORIENTATION.CCW ? "CCW" : face.orientation() === ORIENTATION.CW ? "CW" : "ORIENTATION.NOT_ORIENTABLE" ));
                }
                for (const edge of face.edges) {
                    if (DEBUG_RECTS) {
                        console.log("--POLY EDGE");
                    }
                    if (edge.isSegment) {
                        if (DEBUG_RECTS) {
                            console.log("--POLY SEGMENT...");
                        }
                        const segment = edge.shape as Segment;
                        const pointStart = segment.start;
                        const pointEnd = segment.end;
                        if (DEBUG_RECTS) {
                            console.log("--POLY SEGMENT START x, y: " + pointStart.x + ", " + pointStart.y);
                            console.log("--POLY SEGMENT END x, y: " + pointEnd.x + ", " + pointEnd.y);
                        }
                    } else if (edge.isArc) {
                        if (DEBUG_RECTS) {
                            console.log("--POLY ARC...");
                        }
                        const arc = edge.shape as Arc;

                        if (DEBUG_RECTS) {
                            console.log("--POLY ARC: " + arc.start.x + ", " + arc.start.y);
                            console.log("--POLY ARC: " + arc.end.x + ", " + arc.end.y);
                            console.log("--POLY ARC: " + arc.length + " / " + arc.sweep);
                            // console.log("--POLY ARC: " + arc.ps.x + ", " + arc.ps.y + " (" + arc.r + ") " + "[" + arc.startAngle + ", " + arc.endAngle + "]");
                        }
                    }
                }
            }

            try {
                polygonSurface = offset(polygonSurface, -(gap + gap/2));
            } catch (e) {
                console.log(e);
            }

            if (DEBUG_RECTS) {
                console.log("--==========--==========--==========--==========--==========--==========");
                console.log("--POLY FACES AFTER ...");
            }
            for (const f of polygonSurface.faces) {
                const face = f as Face;
                if (DEBUG_RECTS) {
                    console.log("--................--................--................");
                    console.log("--POLY FACE: " + (face.orientation() === ORIENTATION.CCW ? "CCW" : face.orientation() === ORIENTATION.CW ? "CW" : "ORIENTATION.NOT_ORIENTABLE" ));
                }

                for (const edge of face.edges) {
                    if (DEBUG_RECTS) {
                        console.log("--POLY EDGE");
                    }
                    if (edge.isSegment) {
                        if (DEBUG_RECTS) {
                            console.log("--POLY SEGMENT...");
                        }
                        const segment = edge.shape as Segment;
                        const pointStart = segment.start;
                        const pointEnd = segment.end;
                        if (DEBUG_RECTS) {
                            console.log("--POLY SEGMENT START x, y: " + pointStart.x + ", " + pointStart.y);
                            console.log("--POLY SEGMENT END x, y: " + pointEnd.x + ", " + pointEnd.y);
                        }
                    } else if (edge.isArc) {
                        if (DEBUG_RECTS) {
                            console.log("--POLY ARC...");
                        }
                        const arc = edge.shape as Arc;

                        if (DEBUG_RECTS) {
                            console.log("--POLY ARC: " + arc.start.x + ", " + arc.start.y);
                            console.log("--POLY ARC: " + arc.end.x + ", " + arc.end.y);
                            console.log("--POLY ARC: " + arc.length + " / " + arc.sweep);
                            // console.log("--POLY ARC: " + arc.ps.x + ", " + arc.ps.y + " (" + arc.r + ") " + "[" + arc.startAngle + ", " + arc.endAngle + "]");
                        }
                    }
                }
            }
        }
    }

    if (DEBUG_RECTS) {
        addEdgePoints(polygonCountourUnionPoly, 1);

        if (Array.isArray(polygonSurface)) {
            for (const poly of polygonSurface) {
                addEdgePoints(poly, 1);
            }
        } else {
            addEdgePoints(polygonSurface, 1);
        }
    }

    // const highlightAreaSVGDocFrag = documant.createDocumentFragment();
    // highlightAreaSVGDocFrag.appendChild(highlightAreaSVGRect);
    // const highlightAreaSVGG = documant.createElementNS(SVG_XML_NAMESPACE, "g");
    // highlightAreaSVGG.appendChild(highlightAreaSVGDocFrag);
    const highlightAreaSVG = documant.createElementNS(SVG_XML_NAMESPACE, "svg") as ISVGElementWithPolygon;
    highlightAreaSVG.setAttribute("class", `${CLASS_HIGHLIGHT_COMMON} ${CLASS_HIGHLIGHT_CONTOUR}`);

    // highlightAreaSVG.polygon = polygonSurface;
    highlightAreaSVG.polygon = polygonCountourUnionPoly; // TODO: gap expansion too generous for hit testing?

    // highlightAreaSVG.append((new DOMParser()​​.parseFromString(`<svg xmlns="${SVG_XML_NAMESPACE}">${polys.svg()}</svg>`, "image/svg+xml")).firstChild);
    highlightAreaSVG.innerHTML =
    (
    Array.isArray(polygonSurface)
    ?
    polygonSurface.reduce((prevSVGPath, currentPolygon) => {
        return prevSVGPath + currentPolygon.svg({
            fill: DEBUG_RECTS ? "pink" : (drawOutline || isCssHighlight) ? "transparent" : `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`,
            fillRule: "evenodd",
            stroke: DEBUG_RECTS ? "magenta" : drawOutline ? `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})` : "transparent",
            strokeWidth: DEBUG_RECTS ? 1 : drawOutline ? 2 : 0,
            fillOpacity: 1,
            className: undefined,
            // r: 4,
        });
    }, "")
    :
    polygonSurface.svg({
        fill: DEBUG_RECTS ? "yellow" : (drawOutline || isCssHighlight) ? "transparent" : `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`,
        fillRule: "evenodd",
        stroke: DEBUG_RECTS ? "green" : drawOutline ? `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})` : "transparent",
        strokeWidth: DEBUG_RECTS ? 1 : drawOutline ? 2 : 0,
        fillOpacity: 1,
        className: undefined,
        // r: 4,
    })
    )
    +
    polygonCountourUnionPoly.svg({
        fill: "transparent",
        fillRule: "evenodd",
        stroke: DEBUG_RECTS ? "red" : "transparent",
        strokeWidth: DEBUG_RECTS ? 1 : 1,
        fillOpacity: 1,
        className: undefined,
        // r: 4,
    })
    ;

    highlightParent.append(highlightAreaSVG);

    if (doDrawMargin && highlight.pointerInteraction) {
        const MARGIN_MARKER_THICKNESS = 14 * (win.READIUM2.isFixedLayout ? scale : 1);
        const MARGIN_MARKER_OFFSET = 6 * (win.READIUM2.isFixedLayout ? scale : 1);
        const paginatedOffset_ = paginatedOffset - MARGIN_MARKER_OFFSET - MARGIN_MARKER_THICKNESS;

        let boundingRect: IRect | IRect[] | undefined;
        const polygonCountourMarginRects: IRect[] = [];
        for (const f of polygonCountourUnionPoly.faces) {
            const face = f as Face;

            const b = face.box;
            const left =
                // ----
                vertical ?
                b.xmin :
                // ----
                paginated ?
                (
                    (rtl
                    ?
                    paginatedWidth - MARGIN_MARKER_THICKNESS // - MARGIN_MARKER_OFFSET
                    :
                    0 // MARGIN_MARKER_OFFSET
                    )
                    +
                    (rtl
                    ?
                    -1 * paginatedOffset_
                    :
                    paginatedOffset_
                    )
                    +
                    Math.floor((b.xmin) / paginatedWidth) * paginatedWidth
                )
                :
                // ---- scroll
                (rtl
                ?
                MARGIN_MARKER_OFFSET + bodyRect.width - parseInt(bodyComputedStyle.paddingRight, 10)
                :
                win.READIUM2.isFixedLayout
                ?
                MARGIN_MARKER_OFFSET
                :
                parseInt(bodyComputedStyle.paddingLeft, 10) - MARGIN_MARKER_THICKNESS - MARGIN_MARKER_OFFSET
                );
            const top =
                vertical
                ?
                parseInt(bodyComputedStyle.paddingTop, 10) - MARGIN_MARKER_THICKNESS - MARGIN_MARKER_OFFSET
                :
                b.ymin;
            const width = vertical ? b.width : MARGIN_MARKER_THICKNESS;
            const height = vertical ? MARGIN_MARKER_THICKNESS : b.height;

            const extra = 0;
            // const extra = paginated ? 2 : 0; // useful to union-join small gaps, but here we are able to compute groups of bounding boxes so that in column-paginated mode when crossing over page boundaries there is no gigantic bounding box.

            const r: IRect = {
                left: left - (vertical ? extra : 0),
                top: top - (vertical ? 0 : extra),
                right: left + width + (vertical ? extra : 0),
                bottom: top + height + (vertical ? 0 : extra),
                width: width + extra * 2,
                height: height + extra * 2,
            };

            boundingRect = boundingRect ? getBoundingRect(boundingRect as IRect, r) : r;

            polygonCountourMarginRects.push(r);
        }

        const useFastBoundingRect = true; // we never union-join the polygons, instead we group possible rectangle bounding boxes together to allow fragmentation across page boundaries
        let polygonMarginUnionPoly: Polygon | undefined;
        if (paginated) {
            const tolerance = 1;
            const groups: Array<{
                x: number,
                boxes: IRect[],
            }> = [];
            for (const r of polygonCountourMarginRects) {
                const group = groups.find((g) => {
                    return !(r.left < (g.x - tolerance) || r.left > (g.x + tolerance));
                });

                if (!group) {
                    groups.push({
                        x: r.left,
                        boxes: [r],
                    });
                } else {
                    group.boxes?.push(r);
                }
            }

            // console.log("XX RECTS: " + polygonCountourMarginRects.length);
            // console.log(JSON.stringify(polygonCountourMarginRects, null, 4));
            // console.log("XX GROUPS: " + groups.length);
            // groups.forEach((g) => console.log(JSON.stringify(g.boxes, null, 4)));

            boundingRect = groups.map<IRect>((g) => {
                return g.boxes.reduce((prev, cur) => {
                    if (prev === cur) {
                        return cur;
                    }
                    return getBoundingRect(prev, cur);
                }, g.boxes[0]);
            });
            if (boundingRect.length === 1) {
                boundingRect = boundingRect[0];
            }
        }

        if (useFastBoundingRect) {
            if (boundingRect) {
                polygonMarginUnionPoly = new Polygon();
                if (Array.isArray(boundingRect)) {
                    for (const b of boundingRect) {
                        const f = polygonMarginUnionPoly.addFace(new Box(b.left, b.top, b.right, b.bottom));
                        if (f.orientation() !== BASE_ORIENTATION) {
                            console.log("--POLYGON FACE ORIENTATION CCW/CW reverse() 6");
                            f.reverse();
                        }
                    }
                } else {
                    const f = polygonMarginUnionPoly.addFace(new Box(boundingRect.left, boundingRect.top, boundingRect.right, boundingRect.bottom));
                    if (f.orientation() !== BASE_ORIENTATION) {
                        console.log("--POLYGON FACE ORIENTATION CCW/CW reverse() 7");
                        f.reverse();
                    }
                }
            } else {
                const poly = new Polygon();
                for (const r of polygonCountourMarginRects) {
                    const f = poly.addFace(new Box(r.left, r.top, r.right, r.bottom));
                    if (f.orientation() !== BASE_ORIENTATION) {
                        console.log("--POLYGON FACE ORIENTATION CCW/CW reverse() 8");
                        f.reverse();
                    }
                }
                polygonMarginUnionPoly = new Polygon();
                const f = polygonMarginUnionPoly.addFace(poly.box);
                if (f.orientation() !== BASE_ORIENTATION) {
                    console.log("--POLYGON FACE ORIENTATION CCW/CW reverse() 9");
                    f.reverse();
                }
            }
        } else {
            polygonMarginUnionPoly = polygonCountourMarginRects.reduce((previousPolygon, r) => {
                const b = new Box(r.left, r.top, r.right, r.bottom);
                const p = new Polygon();
                const f = p.addFace(b);
                if (f.orientation() !== BASE_ORIENTATION) {
                    console.log("--POLYGON FACE ORIENTATION CCW/CW reverse() 10");
                    f.reverse();
                }
                return unify(previousPolygon, p);
            }, new Polygon());

            // Array.from(polygonMarginUnionPoly.faces).forEach((face: Face) => {
            //     if (face.orientation() !== BASE_ORIENTATION) {
            //         if (DEBUG_RECTS) {
            //             console.log("--HIGH WEBVIEW-- removing polygon orientation face / inner hole (margin))");
            //         }
            //         (polygonMarginUnionPoly as Polygon).deleteFace(face);
            //     }
            // });
        }

        const highlightMarginSVG = documant.createElementNS(SVG_XML_NAMESPACE, "svg") as ISVGElementWithPolygon;
        highlightMarginSVG.setAttribute("class", `${CLASS_HIGHLIGHT_COMMON} ${CLASS_HIGHLIGHT_CONTOUR_MARGIN}`);
        highlightMarginSVG.polygon = polygonMarginUnionPoly;
        highlightMarginSVG.innerHTML = polygonMarginUnionPoly.svg({
            fill: `rgb(${highlight.color.red}, ${highlight.color.green}, ${highlight.color.blue})`,
            fillRule: "evenodd",
            stroke: "transparent",
            strokeWidth: 0,
            // stroke: "magenta",
            // strokeWidth: 1,
            fillOpacity: 1,
            className: undefined,
            // r: 4,
        });

        highlightParent.append(highlightMarginSVG);
    }

    return highlightParent;
}
