package org.finagm.utj.memory;

import net.sf.cglib.proxy.Enhancer;
import net.sf.cglib.proxy.MethodInterceptor;
import net.sf.cglib.proxy.MethodProxy;

import java.lang.reflect.Method;

/**
 * JavaMethodAreaOOM
 * VM Args: -Xms5M -Xmx5M --add-opens java.base/java.lang=ALL-UNNAMED --add-opens java.base/java.lang.reflect=ALL-UNNAMED
 *
 * @author huligang
 * @since 2026-04-12
 */
public class JavaMethodAreaOOM {

    public static void main(String[] args) {
        while (true) {
            Enhancer enhancer = new Enhancer();
            enhancer.setSuperclass(OOMObject.class);
            enhancer.setUseCache(false);
            enhancer.setCallback(new MethodInterceptor() {
                @Override
                public Object intercept(Object o, Method method, Object[] objects, MethodProxy methodProxy) throws Throwable {
                    System.out.println("proxy haha");
                    return methodProxy.invokeSuper(o, args);
                }
            });
            OOMObject obj = (OOMObject) enhancer.create();
            obj.display();
        }
    }

    public static class OOMObject {

        public void display() {
            System.out.println("hello world");
        }
    }
}
