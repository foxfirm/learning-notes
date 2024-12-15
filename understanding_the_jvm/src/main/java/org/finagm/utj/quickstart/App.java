package org.finagm.utj.quickstart;

import org.finagm.utj.clazz.TestClass;

/**
 * Hello world!
 */
public class App {
    private int y = 0;

    public static void main(String[] args) {
        App app = new App();
        int a = 5;
        app.getClass();
        char[] c = new char[1];
        Class dd = char[].class;
        Class cc = c.getClass();
        System.out.println(cc);
        if(c instanceof Object){
            System.out.println(cc);
        }
        Class d = cc.getClass();
        Class e = d.getClass();
        Class i = int.class;
        System.out.println(i);

        System.out.println(Integer.TYPE == int.class);

    }


}
