package org.finagm.leetcode.rectangle;

/**
 * RectangleTest
 *
 * @author huligang
 * @since 2026-11-07
 */
public class RectangleTest {
    public static void main(String[] args) {

    }

    public static boolean isOverlap(int[] a, int[] b) {
        int aRow = a[0], aCol = a[1], aW = a[2], aH = a[3];
        int bRow = b[0], bCol = b[1], bW = b[2], bH = b[3];
        boolean inLeft = aCol + aW <= bCol;
        boolean inRight = aCol >= bCol + bW;
        boolean inTop = aRow + aH <= bRow;
        boolean inBottom = aRow >= bRow + bH;
        return !(inLeft || inRight || inTop || inBottom);
    }
}
