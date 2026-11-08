package org.finagm.leetcode.rectangle;

import org.junit.experimental.max.MaxHistory;

import java.util.*;

/**
 * PbrushSystem
 *
 * @author huligang
 * @since 2026-11-07
 */
public class PbrushSystem {

    /**
     * 0,1,2,3,4,5,6,7,8,9
     * 0
     *
     * @param args
     */
    public static void main(String[] args) {
        PbrushSystem app = new PbrushSystem();
        System.out.println(app.queryArea());
        System.out.println(app.drawRectangle(0 ,1 ,5,4));
        System.out.println(app.drawRectangle(0 ,7 ,1,1));
        System.out.println(app.drawRectangle(2 ,7 ,1,3));
        System.out.println(app.drawRectangle(5 ,3,2,2));
        System.out.println(app.drawRectangle(4 ,1 ,3,2));
        System.out.println(app.queryArea());
        System.out.println(app.eraseArea(1,3 ,4,6));
        System.out.println(app.eraseArea(1,3 ,4,6));
        System.out.println(app.queryArea());
        System.out.println(app.drawRectangle(2,8 ,93,1));
        System.out.println(app.drawRectangle(2,8 ,92,1));

    }

    Set<Rectangle> drawRects;

    PbrushSystem() {
        drawRects = new HashSet<>();
    }

    boolean drawRectangle(int row, int col, int width, int height) {
        if (row < 0 || row > 100 || col < 0 || col > 100) {
            return false;
        }
        if (row + width > 100 || col + height > 100) {
            return false;
        }
        Rectangle rectangle = new Rectangle(row, col, width, height);
        if (drawRects.contains(rectangle)) {
            return false;
        }
        for (Rectangle r : drawRects) {
            if (isOverlap(r, rectangle)) {
                return false;
            }
        }
        drawRects.add(rectangle);
        return true;
    }

    private boolean isOverlap(Rectangle a, Rectangle b) {
        boolean inLeft = a.col + a.width <= b.col;
        boolean inRight = a.col >= b.col + b.width;
        boolean inTop = a.row + a.height <= b.row;
        boolean inBottom = a.row >= b.row + b.height;
        return !(inLeft || inRight || inTop || inBottom);
    }

    int eraseArea(int row, int col, int width, int height) {
        int count = 0;
        Rectangle rectangle = new Rectangle(row, col, width, height);
        Iterator<Rectangle> iterator = drawRects.iterator();
        while (iterator.hasNext()) {
            Rectangle r = iterator.next();
            if (isOverlap(r, rectangle)) {
                iterator.remove();
                count++;
            }
        }
        return count;
    }

    int queryArea() {
        if(drawRects.isEmpty()){
            return 0;
        }
        Rectangle f = drawRects.iterator().next();
        int left = f.col, right = 0, top = f.row, bottom = 0;
        for (Rectangle r : drawRects) {
            left = Math.min(left, r.col);
            right = Math.max(right, r.col + r.width);
            top = Math.min(top, r.row);
            bottom = Math.max(bottom, r.row + r.height);
        }
        return (right - left) * (bottom - top);
    }


    public static class Rectangle {
        int row;
        int col;
        int width;
        int height;

        public Rectangle(int row, int col, int width, int height) {
            this.row = row;
            this.col = col;
            this.width = width;
            this.height = height;
        }

        @Override
        public boolean equals(Object o) {
            if (o == null || getClass() != o.getClass()) return false;
            Rectangle rectangle = (Rectangle) o;
            return row == rectangle.row && col == rectangle.col && width == rectangle.width && height == rectangle.height;
        }

        @Override
        public int hashCode() {
            return Objects.hash(row, col, width, height);
        }

        @Override
        public String toString() {
            return "Rectangle{" +
                    "row=" + row +
                    ", col=" + col +
                    ", width=" + width +
                    ", height=" + height +
                    '}';
        }
    }
}
