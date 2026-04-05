package org.finagm.leetcode.dailychallenge;

/**
 * Leetcode657
 *
 * @author huligang
 * @since 2026-04-05
 */
public class Leetcode657 {

    public boolean judgeCircle(String moves) {
        if (moves == null || moves.isEmpty()) {
            return true;
        }
        int x = 0;
        int y = 0;
        char[] moveArray = moves.toCharArray();
        for (char c : moveArray) {
            switch (c) {
                case 'U':
                    x += 1;
                    break;
                case 'D':
                    x -= 1;
                    break;
                case 'L':
                    y -= 1;
                    break;
                case 'R':
                    y += 1;
                    break;
                default:
                    break;
            }
        }
        return x == 0 && y == 0;
    }
}
