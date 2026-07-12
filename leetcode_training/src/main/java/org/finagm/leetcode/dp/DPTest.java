package org.finagm.leetcode.dp;

import org.junit.Assert;
import org.junit.Test;

import java.util.*;

/**
 * DPTest
 *
 * @author ligang
 * @since 2025-06-18
 */
public class DPTest {

    public static void main(String[] args) {
        Node a1 = new Node(2, 4);
        Node a2 = new Node(1, 2);
        Node a3 = new Node(3, 3);
        Node[] nodes = new Node[]{a1, a2, a3};
        //System.out.println(zeroOnePackage(nodes, 4));

        System.out.println(knapsack(4, 3, new int[]{2, 1, 3}, new int[]{4, 2, 3}));
    }

    public static int fib(int n) {
        int[] dp = new int[n + 1];
        dp[1] = 1;
        dp[2] = 1;
        for (int i = 3; i <= n; i++) {
            dp[i] = dp[i - 1] + dp[i - 2];
        }
        return dp[n];
    }

    public int coinChange(int[] coins, int amount) {
        int[] dp = new int[amount + 1];
        Arrays.fill(dp, amount + 1);
        dp[0] = 0;
        for (int i = 1; i <= amount; i++) {
            for (int coin : coins) {
                if (i - coin < 0) {
                    continue;
                }
                dp[i] = Math.min(dp[i], dp[i - coin] + 1);
            }
        }
        return dp[amount] == amount + 1 ? -1 : dp[amount];
    }

    public int maxEnvelopes(int[][] envelopes) {
        if (envelopes == null || envelopes.length == 0) {
            return 0;
        }
        Arrays.sort(envelopes, (p1, p2) -> {
            if (p1[0] == p2[0]) {
                return Integer.compare(p1[1], p2[1]);
            } else {
                return Integer.compare(p1[0], p2[0]);
            }
        });
        int length = envelopes.length;
        int[] dp = new int[length];
        Arrays.fill(dp, 1);
        for (int i = 1; i < length; i++) {
            for (int j = 0; j < i; j++) {
                if (envelopes[i][0] > envelopes[j][0] && envelopes[i][1] > envelopes[j][1]) {
                    dp[i] = Math.max(dp[i], dp[j] + 1);
                }
            }
        }
        int res = 0;
        for (int i : dp) {
            res = Math.max(res, i);
        }
        return res;
    }

    public int longestCommonSubsequence(String text1, String text2) {
        if (text1 == null || text1.length() == 0 || text2 == null || text2.length() == 0) {
            return 0;
        }
        int m = text1.length(), n = text2.length();
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (text1.charAt(i - 1) == text2.charAt(j - 1)) {
                    dp[i][j] = 1 + dp[i - 1][j - 1];
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }
        return dp[m][n];
    }

    public int minDistance1(String word1, String word2) {
        int m = word1.length(), n = word2.length();
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 1; i <= m; i++) {
            dp[i][0] = i;
        }
        for (int j = 1; j <= n; j++) {
            dp[0][j] = j;
        }
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (word1.charAt(i - 1) == word2.charAt(j - 1)) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1]) + 1;
                }
            }
        }
        return dp[m][n];
    }

    public int minimumDeleteSum(String s1, String s2) {
        int m = s1.length(), n = s2.length();
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 1; i <= m; i++) {
            dp[i][0] = dp[i - 1][0] + s1.charAt(i - 1);
        }
        for (int j = 1; j <= n; j++) {
            dp[0][j] = dp[0][j - 1] + s2.charAt(j - 1);
        }
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (s1.charAt(i - 1) == s2.charAt(j - 1)) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = Math.min(dp[i - 1][j] + s1.charAt(i - 1), dp[i][j - 1] + s2.charAt(j - 1));
                }
            }
        }
        return dp[m][n];
    }

    public int maxSubArray(int[] nums) {
        int n = nums.length;
        int[] dp = new int[n];
        dp[0] = nums[0];
        for (int i = 1; i < n; i++) {
            dp[i] = Math.max(dp[i - 1] + nums[i], nums[i]);
        }
        int res = dp[0];
        for (int i = 1; i < n; i++) {
            res = Math.max(res, dp[i]);
        }
        return res;
    }

    public static class Node {
        public int wt;
        public int val;

        public Node(int wt, int val) {
            this.wt = wt;
            this.val = val;
        }
    }

    public static int zeroOnePackage(Node[] nodes, int w) {
        int n = nodes.length;
        int[][] dp = new int[n + 1][w + 1];
        for (int i = 1; i <= n; i++) {
            for (int j = 1; j <= w; j++) {
                Node node = nodes[i - 1];
                if (node.wt > j) {
                    dp[i][j] = dp[i - 1][j];
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j - node.wt] + node.val, dp[i - 1][j]);
                }
            }
        }
        return dp[n][w];
    }

    /**
     * 0-1 背包问题 - 二维动态规划解法
     * 在不超过背包容量的情况下，计算能装入物品的最大价值
     * <p>
     * 示例参数:
     * N = 3, W = 4
     * wt = [2, 1, 3]
     * val = [4, 2, 3]
     *
     * @param w   背包的最大承重容量
     * @param n   物品的数量
     * @param wt  每个物品的重量数组，wt[i] 表示第 i 个物品的重量
     * @param val 每个物品的价值数组，val[i] 表示第 i 个物品的价值
     * @return 能装入背包的最大总价值
     */
    public static int knapsack(int w, int n, int[] wt, int[] val) {
        // dp[i][j] 表示前 i 个物品在背包容量为 j 时能获得的最大价值
        int[][] dp = new int[n + 1][w + 1];

        // 遍历每个物品
        for (int i = 1; i <= n; i++) {
            // 遍历每种背包容量
            for (int j = 1; j <= w; j++) {
                // 当前物品重量超过背包容量，无法装入，继承前一个物品的最优解
                if (j - wt[i - 1] < 0) {
                    dp[i][j] = dp[i - 1][j];
                } else {
                    // 选择装入或不装入当前物品的最大值
                    // 不装：dp[i-1][j]
                    // 装入：dp[i-1][j-wt[i-1]] + val[i-1]
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i - 1][j - wt[i - 1]] + val[i - 1]);
                }
            }
        }

        // 返回 n 个物品在容量 w 下的最大价值
        return dp[n][w];
    }


    @Test
    public void test() {
        Assert.assertEquals(13, findRotateSteps("godding", "godding"));
    }


    public int findRotateSteps(String ring, String key) {
        int m = ring.length();
        int n = key.length();
        Map<Character, List<Integer>> indexesMap = new HashMap<>();
        for (int i = 0; i < m; i++) {
            char c = ring.charAt(i);
            indexesMap.computeIfAbsent(c, k -> new ArrayList<>()).add(i);
        }

        //  预计算距离
        int[][] distance = new int[m][m];
        for (int i = 0; i < m; i++) {
            for (int j = 0; j < m; j++) {
                int delta = Math.abs(i - j);
                delta = Math.min(delta, m - delta);
                distance[i][j] = delta;
            }
        }

        int[][] dp = new int[m][n];
        for (int i = 0; i < m; i++) {
            int minSteps = Integer.MAX_VALUE;
            for (int index : indexesMap.get(key.charAt(n - 1))) {
                minSteps = Math.min(minSteps, distance[i][index] + 1);
            }
            dp[i][n - 1] = minSteps;
        }
        for (int j = n - 2; j >= 0; j--) {
            for (int i = m - 1; i >= 0; i--) {
                int minSteps = Integer.MAX_VALUE;
                for (int index : indexesMap.get(key.charAt(j))) {
                    minSteps = Math.min(minSteps, distance[i][index] + 1 + dp[index][j + 1]);
                }
                dp[i][j] = minSteps;
            }
        }
        return dp[0][0];
    }


}
