package org.finagm.utj.jdk;

import java.util.concurrent.locks.LockSupport;

/**
 * DebugJDK21
 *
 * @author huligang
 * @since 2026-04-06
 */
public class DebugJDK21 {


    public static void main(String[] args) {
        // 创建两个内容相同但对象不同的字符串
        String s1 = new String("hello");
        String s2 = new String("hello");

        System.out.println("Before intern:");
        System.out.println("s1 == s2 : " + (s1 == s2));  // false，不同对象

        // 调用 intern() 方法
        String s3 = s1.intern();  // ← 在这里会触发 native 方法
        String s4 = s2.intern();

        System.out.println("After intern:");
        System.out.println("s3 == s4 : " + (s3 == s4));  // true，都指向常量池中的同一个对象
        System.out.println("s1 == s3 : " + (s1 == s3));  // false，s1 是堆中对象，s3 是常量池对象

        // 再测试一个直接的字面量
        String s5 = "world";
        String s6 = new String("world").intern();
        System.out.println("s5 == s6 : " + (s5 == s6));  // true
    }


}
