package org.finagm.utj.memory;

import java.util.ArrayList;
import java.util.List;

/**
 * HeapOOM
 * VM Args: -Xms20m -Xmx20m -XX:+HeapDumpOnOutOfMemoryError
 *
 * @author huligang
 * @since 2026-04-12
 */
public class HeapOOM {
    static class OOMObject {
    }

    public static void main(String[] args) {
        List<OOMObject> list = new ArrayList<OOMObject>();
        while (true) {
            // list.add(new OOMObject());
        }
    }
}
