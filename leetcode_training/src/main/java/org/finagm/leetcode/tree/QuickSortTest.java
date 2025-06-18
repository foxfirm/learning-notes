package org.finagm.leetcode.tree;

import java.util.Arrays;
import java.util.PriorityQueue;

/**
 * QuickSortTest
 *
 * @author ligang
 * @since 2024-12-15
 */
public class QuickSortTest {

    public static void main(String[] args) {
        QuickSortTest app = new QuickSortTest();
        int[] nums = new int[]{5, 2, 3, 1};
        System.out.println(Arrays.toString(nums));
        app.sortArray(nums);
        System.out.println(Arrays.toString(nums));
    }


    public int[] sortArray(int[] nums) {
        quickSort(nums, 0, nums.length - 1);
        return nums;
    }

    private void quickSort(int[] nums, int lo, int hi) {
        if (lo >= hi) {
            return;
        }
        int p = partition(nums, lo, hi);
        quickSort(nums, lo, p - 1);
        quickSort(nums, p + 1, hi);
    }

    private int partition2(int[] nums, int lo, int hi) {
        int x = nums[lo + (hi - lo) / 2];
        int i = lo - 1, j = hi + 1;
        while (i < j) {
            do {
                i++;
            } while (nums[i] < x);
            do {
                j--;
            } while (nums[j] > x);
            if (i >= j) {
                break;
            }
            int temp = nums[i];
            nums[i] = nums[j];
            nums[j] = temp;
        }
        return j;
    }


    private int partition(int[] nums, int lo, int hi) {
        int x = nums[hi];
        int j = lo - 1;
        for (int i = lo; i < hi; i++) {
            if (nums[i] <= x) {
                j++;
                int temp = nums[i];
                nums[i] = nums[j];
                nums[j] = temp;
            }
        }
        j++;
        int temp = nums[hi];
        nums[hi] = nums[j];
        nums[j] = temp;
        return j;
    }



    public int findKthLargest(int[] nums, int k) {
        if (nums == null || k > nums.length) {
            return -1;
        }
        PriorityQueue<Integer> priorityQueue = new PriorityQueue<>((p1, p2) -> Integer.compare(p2, p1));
        for (int num : nums) {
            priorityQueue.add(num);
        }
        int i = 1;
        while (i < k) {
            priorityQueue.poll();
            i++;
        }
        return priorityQueue.peek();
    }

}
