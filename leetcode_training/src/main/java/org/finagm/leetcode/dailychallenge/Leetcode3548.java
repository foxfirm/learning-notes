package org.finagm.leetcode.dailychallenge;

import java.util.HashSet;
import java.util.Set;

/**
 * Leetcode3548
 *
 * @author huligang
 * @since 2026-04-05
 */
public class Leetcode3548 {

    public static void main(String[] args) {
        Leetcode3548 app = new Leetcode3548();
        System.out.println(app.canPartitionGrid(new int[][]{{253,10,10}}));
    }

    /**
     * 判断是否可以通过一条水平或垂直分割线将矩阵分割成两部分，使得两部分元素和相等，
     * 或者通过从其中一部分移除至多一个元素后使两部分和相等且保持连通。
     * <p>
     * 算法思路：
     * 1. 计算矩阵总和，若为奇数则直接返回false
     * 2. 通过旋转矩阵4次（0°、90°、180°、270°），将水平和垂直分割统一处理
     * 3. 对于每种旋转状态，检查是否存在有效地分割线
     * 4. 特殊处理单行和单列的情况
     *
     * @param grid 由正整数组成的 m x n 矩阵
     * @return 如果存在满足条件的分割方式返回true，否则返回false
     */
    public boolean canPartitionGrid(int[][] grid) {
        int m = grid.length;
        int n = grid[0].length;
        long total = 0;
        for (int i = 0; i < m; i++) {
            for (int j = 0; j < n; j++) {
                total += grid[i][j];
            }
        }

        // 通过4次旋转变换，统一处理水平和垂直分割的情况
        for (int k = 0; k < 4; k++) {
            m = grid.length;
            n = grid[0].length;

            // 跳过单行情况，通过旋转转换为单列处理
            if (m == 1) {
                grid = rotation(grid);
                continue;
            }

            long sum = 0;

            // 处理单列情况的分割
            if (n == 1) {
                for (int i = 0; i < m - 1; i++) {
                    sum += grid[i][0];
                    long tag = sum * 2 - total;
                    if (tag == 0 || tag == grid[0][0] || tag == grid[i][0]) {
                        return true;
                    }
                }
                grid = rotation(grid);
                continue;
            }

            // 处理多行多列的一般情况，使用HashSet记录可删除的元素值
            Set<Long> exist = new HashSet<>();
            exist.add(0L);
            for (int i = 0; i < m; i++) {
                for (int j = 0; j < n; j++) {
                    sum += grid[i][j];
                    exist.add((long) grid[i][j]);
                }
                long tag = sum * 2 - total;

                // 第一行只能删除首尾元素以保持连通性
                if (i == 0) {
                    if (tag == 0 || tag == grid[0][0] || tag == grid[0][n - 1]) {
                        return true;
                    }
                    continue;
                }

                // 检查是否存在需要删除的元素值
                if (exist.contains(tag)) {
                    return true;
                }
            }
            grid = rotation(grid);
        }
        return false;
    }

    /**
     * 将矩阵顺时针旋转90度。
     * 通过旋转变换，可以将垂直分割问题转换为水平分割问题统一处理。
     * 旋转公式：新矩阵的第j行第(m-i-1)列 = 原矩阵的第i行第j列
     *
     * @param grid 原始 m x n 矩阵
     * @return 旋转后的 n x m 矩阵（顺时针旋转90度）
     */
    private int[][] rotation(int[][] grid) {
        int m = grid.length;
        int n = grid[0].length;
        int[][] res = new int[n][m];
        for (int i = 0; i < m; i++) {
            for (int j = 0; j < n; j++) {
                res[j][m - i - 1] = grid[i][j];
            }
        }
        return res;
    }
}
