import jpos.JposException;
import jpos.RFIDScanner;
import jpos.events.*;
import com.zebra.log.rfid.scanner.JCoreLoggerSetup;
import com.zebra.jpos.service.rfid.RFIDScannerService115Impl;
import com.zebra.NGEAPI.NGEAPI.parameters.BEEP_VOLUME_LEVEL;
import java.util.Date;
import java.util.Hashtable;
import java.text.SimpleDateFormat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

/**
 * Bridge between Zebra FXP20 JPOS driver and Node.js middleware.
 * Mirrors the exact initialization sequence from Zebra's demo app.
 */
public class FXP20Bridge implements DataListener, ErrorListener, StatusUpdateListener, OutputCompleteListener {

    private RFIDScanner reader;
    private volatile boolean running = false;
    private volatile boolean inventoryActive = false;
    private SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

    private static int cmd = 16;
    private static int start = 0;
    private static int length = 0;
    private static int timeout = 500;
    private static byte[] filterID = new byte[0];
    private static byte[] filterMask = new byte[0];
    private static byte[] password = new byte[] {0, 0, 0, 0};

    public FXP20Bridge() {
        this.reader = new RFIDScanner();
    }

    /** Step 1: OPEN - matches demo app option 1 */
    public void open() throws JposException {
        log("INFO", "Opening device...");
        reader.open("ZebraRFIDScanners");
        log("INFO", "Device opened");
    }

    /** Step 2: CLAIM - matches demo app option 2 exactly */
    public void claim() throws JposException {
        log("INFO", "Claiming device...");
        reader.claim(1000);
        log("INFO", "Device claimed");

        reader.setDeviceEnabled(true);
        log("INFO", "Device enabled");

        reader.addDataListener(this);
        reader.addStatusUpdateListener(this);
        reader.addOutputCompleteListener(this);
        reader.addErrorListener(this);

        reader.setDataEventEnabled(true);
        log("INFO", "Device ready, listeners attached");
        outputStatus("connected");
    }

    /** READ TAGS by timer - matches demo app option 1 in operation menu */
    public void readTagsByTimer() {
        log("INFO", "Reading tags by timer (timeout=" + timeout + "ms)...");

        try {
            reader.readTags(cmd, filterID, filterMask, start, length, timeout, password);
            Thread.sleep(100);

            int tagCount = reader.getTagCount();

            if (tagCount > 0) {
                iterateAndOutputTags(tagCount);
            } else {
                log("INFO", "No tags found");
            }
        } catch (JposException e) {
            logError("readTags failed", e);
        } catch (InterruptedException e) {
            log("WARN", "Interrupted during read");
        }
    }

    /** Navigate through tags using firstTag/nextTag cursor pattern, with RSSI from internal tag store */
    private void iterateAndOutputTags(int tagCount) {
        Hashtable<String, rfid.api.TagData> store = null;
        try { store = RFIDScannerService115Impl.tagStore; } catch (Exception e) { /* not available */ }

        try {
            reader.firstTag();
            for (int i = 0; i < tagCount; i++) {
                byte[] tagId = reader.getCurrentTagID();

                if (tagId != null && tagId.length > 0) {
                    String epc = bytesToHex(tagId);
                    short rssi = 0;
                    short antenna = 0;

                    if (store != null) {
                        rfid.api.TagData td = store.get(epc);
                        if (td != null) {
                            rssi = td.getPeakRSSI();
                            antenna = td.getAntennaID();
                        }
                    }

                    outputTagRead(epc, rssi, antenna);
                }
                if (i < tagCount - 1) {
                    reader.nextTag();
                }
            }
        } catch (JposException e) {
            logError("Error iterating tags", e);
        }
    }

    /** START/STOP Inventory - matches demo app option 2 in operation menu */
    public void startInventory() {
        if (inventoryActive) {
            log("WARN", "Inventory already active");
            return;
        }

        log("INFO", "Starting inventory (startReadTags)...");

        try {
            reader.startReadTags(cmd, filterID, filterMask, start, length, password);
            inventoryActive = true;
            outputStatus("reading");
            log("INFO", "Inventory started - tags arrive via events");
        } catch (JposException e) {
            logError("startReadTags failed", e);
            outputStatus("error");
        }
    }

    public void stopInventory() {
        if (!inventoryActive) return;

        log("INFO", "Stopping inventory...");
        try {
            reader.stopReadTags(password);
            Thread.sleep(100);

            int tagCount = reader.getTagCount();
            log("INFO", "Tags after stop: " + tagCount);
            if (tagCount > 0) iterateAndOutputTags(tagCount);
        } catch (Exception e) {
            log("WARN", "stopReadTags: " + e.getMessage());
        }

        inventoryActive = false;
        outputStatus("connected");
        log("INFO", "Inventory stopped");
    }

    /** Continuous read loop using readTags (timer-based) */
    public void startContinuousRead() {
        if (inventoryActive) return;

        log("INFO", "Starting continuous read loop...");
        inventoryActive = true;
        outputStatus("reading");

        Thread readThread = new Thread(() -> {
            while (inventoryActive) {
                try {
                    reader.readTags(cmd, filterID, filterMask, start, length, timeout, password);

                    int tagCount = reader.getTagCount();
                    if (tagCount > 0) {
                        iterateAndOutputTags(tagCount);
                    }

                    Thread.sleep(50);
                } catch (JposException e) {
                    log("WARN", "readTags error: " + e.getMessage());
                    try { Thread.sleep(1000); } catch (InterruptedException ie) { break; }
                } catch (InterruptedException e) {
                    break;
                }
            }
            log("INFO", "Continuous read loop stopped");
        });
        readThread.setDaemon(true);
        readThread.start();
    }

    public void stopContinuousRead() {
        inventoryActive = false;
        outputStatus("connected");
    }

    /** Get the internal rfid.api.Config object via reflection */
    private Object getInternalConfig() throws Exception {
        Field serviceField = reader.getClass().getDeclaredField("service115");
        serviceField.setAccessible(true);
        Object service = serviceField.get(reader);

        Field readerField = null;
        Class<?> cls = service.getClass();
        while (cls != null && readerField == null) {
            try { readerField = cls.getDeclaredField("myReader"); } catch (NoSuchFieldException e) { cls = cls.getSuperclass(); }
        }
        if (readerField == null) throw new Exception("Cannot find myReader field");
        readerField.setAccessible(true);
        Object rfidReader = readerField.get(service);

        Field configField = rfidReader.getClass().getField("Config");
        return configField.get(rfidReader);
    }

    /** Trigger hardware beep via reflection into the JPOS service's internal RFIDReader */
    public void beep() {
        try {
            Object config = getInternalConfig();
            Method beepMethod = config.getClass().getMethod("beep", int.class, int.class, int.class, BEEP_VOLUME_LEVEL.class);
            beepMethod.invoke(config, 200, 100, 1, BEEP_VOLUME_LEVEL.HIGH);
            log("INFO", "Hardware beep triggered");
        } catch (Exception e) {
            log("WARN", "Hardware beep not available: " + e.getMessage());
        }
    }

    /** Query antenna configuration via reflection into Config.Antennas */
    public void getAntennaConfig() {
        try {
            Object config = getInternalConfig();

            Field antennasField = config.getClass().getField("Antennas");
            Object antennas = antennasField.get(config);

            short[] available = null;
            try {
                Method getAvail = antennas.getClass().getMethod("getAvailableAntennas");
                available = (short[]) getAvail.invoke(antennas);
            } catch (Exception e) {
                available = new short[] {1, 2, 3, 4};
            }

            StringBuilder sb = new StringBuilder();
            sb.append("{\"type\":\"antenna_config\",\"antennas\":[");

            for (int i = 0; i < available.length; i++) {
                short antId = available[i];
                int power = 270;

                try {
                    Method getRfConfig = antennas.getClass().getMethod("getAntennaRfConfig", short.class);
                    Object rfConfig = getRfConfig.invoke(antennas, antId);
                    if (rfConfig != null) {
                        Method getPower = rfConfig.getClass().getMethod("getTransmitPowerIndex");
                        Object powerVal = getPower.invoke(rfConfig);
                        power = ((Number) powerVal).intValue();
                    }
                } catch (Exception e) {
                    log("WARN", "Cannot read power for antenna " + antId + ": " + e.getMessage());
                }

                if (i > 0) sb.append(",");
                sb.append(String.format("{\"id\":%d,\"power\":%d}", antId, power));
            }

            sb.append("]}");
            System.out.println(sb.toString());
            System.out.flush();
        } catch (Exception e) {
            logError("getAntennaConfig failed", e);
        }
    }

    /** Set per-antenna transmit power via reflection */
    public void setAntennaPower(int antennaId, int power) {
        try {
            Object config = getInternalConfig();

            Field antennasField = config.getClass().getField("Antennas");
            Object antennas = antennasField.get(config);

            Method getRfConfig = antennas.getClass().getMethod("getAntennaRfConfig", short.class);
            Object rfConfig = getRfConfig.invoke(antennas, (short) antennaId);

            if (rfConfig != null) {
                Method setPower = rfConfig.getClass().getMethod("setTransmitPowerIndex", short.class);
                setPower.invoke(rfConfig, (short) power);

                Method setRfConfig = antennas.getClass().getMethod("setAntennaRfConfig", short.class, rfConfig.getClass());
                setRfConfig.invoke(antennas, (short) antennaId, rfConfig);

                String timestamp = dateFormat.format(new Date());
                System.out.println(String.format(
                    "{\"type\":\"antenna_power_set\",\"timestamp\":\"%s\",\"antennaId\":%d,\"power\":%d}",
                    timestamp, antennaId, power));
                System.out.flush();
                log("INFO", "Antenna " + antennaId + " power set to " + power);
            }
        } catch (Exception e) {
            logError("setAntennaPower failed for antenna " + antennaId, e);
        }
    }

    public void disconnect() {
        log("INFO", "Disconnecting...");
        if (inventoryActive) stopInventory();

        try { reader.setDeviceEnabled(false); } catch (Exception e) { /* ignore */ }
        try { reader.release(); } catch (Exception e) { /* ignore */ }
        try { reader.close(); } catch (Exception e) { /* ignore */ }

        outputStatus("disconnected");
        log("INFO", "Disconnected");
    }

    @Override
    public void dataOccurred(DataEvent event) {
        try {
            byte[] tagData = reader.getCurrentTagID();
            if (tagData != null && tagData.length > 0) {
                String epc = bytesToHex(tagData);
                short rssi = 0;
                short antenna = 0;
                try {
                    Hashtable<String, rfid.api.TagData> store = RFIDScannerService115Impl.tagStore;
                    if (store != null) {
                        rfid.api.TagData td = store.get(epc);
                        if (td != null) { rssi = td.getPeakRSSI(); antenna = td.getAntennaID(); }
                    }
                } catch (Exception e) { /* not available */ }
                outputTagRead(epc, rssi, antenna);
            }
            reader.setDataEventEnabled(true);
        } catch (JposException e) {
            logError("dataOccurred error", e);
        }
    }

    @Override
    public void errorOccurred(ErrorEvent event) {
        logError("JPOS Error", new Exception("ErrorCode: " + event.getErrorCode()));
    }

    @Override
    public void statusUpdateOccurred(StatusUpdateEvent event) {
        log("STATUS", "Device status: " + event.getStatus());
    }

    @Override
    public void outputCompleteOccurred(OutputCompleteEvent event) {
        log("STATUS", "Output complete: " + event.getOutputID());
    }

    private void outputTagRead(String epc, short rssi, short antenna) {
        String timestamp = dateFormat.format(new Date());
        System.out.println(String.format(
            "{\"type\":\"tag_read\",\"timestamp\":\"%s\",\"epc\":\"%s\",\"rssi\":%d,\"antenna\":%d,\"readerId\":\"FXP20-01\"}",
            timestamp, epc, rssi, antenna));
        System.out.flush();
    }

    private void outputStatus(String status) {
        String timestamp = dateFormat.format(new Date());
        System.out.println(String.format(
            "{\"type\":\"status\",\"timestamp\":\"%s\",\"status\":\"%s\"}", timestamp, status));
        System.out.flush();
    }

    private void log(String level, String message) {
        String timestamp = dateFormat.format(new Date());
        System.out.println(String.format(
            "{\"type\":\"log\",\"level\":\"%s\",\"timestamp\":\"%s\",\"message\":\"%s\"}",
            level, timestamp, message.replace("\"", "'")));
        System.out.flush();
    }

    private void logError(String message, Exception e) {
        String timestamp = dateFormat.format(new Date());
        String err = e.getMessage() != null ? e.getMessage().replace("\"", "'") : "unknown";
        System.out.println(String.format(
            "{\"type\":\"error\",\"timestamp\":\"%s\",\"message\":\"%s\",\"error\":\"%s\"}",
            timestamp, message, err));
        System.out.flush();
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02X", b));
        return sb.toString();
    }

    public static void main(String[] args) {
        JCoreLoggerSetup.SetUp();
        FXP20Bridge bridge = new FXP20Bridge();

        try {
            // Step 1: OPEN (Thread-2 crash is expected, ignore it)
            bridge.open();

            // Wait for driver to settle after crash
            bridge.log("INFO", "Waiting for driver to settle...");
            Thread.sleep(5000);

            // Step 2: CLAIM + ENABLE (matches demo app flow)
            bridge.claim();

            bridge.log("INFO", "Bridge ready. Commands: READ, START, STOP, QUIT");
            bridge.running = true;

            BufferedReader stdin = new BufferedReader(new InputStreamReader(System.in));
            while (bridge.running) {
                if (stdin.ready()) {
                    String line = stdin.readLine();
                    if (line == null) break;

                    String upper = line.trim().toUpperCase();
                    String[] parts = upper.split("\\s+");

                    switch (parts[0]) {
                        case "READ":
                            bridge.readTagsByTimer();
                            break;
                        case "START":
                            bridge.startInventory();
                            break;
                        case "CSTART":
                            bridge.startContinuousRead();
                            break;
                        case "STOP":
                            bridge.stopInventory();
                            bridge.stopContinuousRead();
                            break;
                        case "BEEP":
                            bridge.beep();
                            break;
                        case "ANTENNAS":
                            bridge.getAntennaConfig();
                            break;
                        case "SETPOWER":
                            if (parts.length >= 3) {
                                bridge.setAntennaPower(Integer.parseInt(parts[1]), Integer.parseInt(parts[2]));
                            } else {
                                bridge.log("WARN", "Usage: SETPOWER <antennaId> <power>");
                            }
                            break;
                        case "QUIT":
                            bridge.running = false;
                            break;
                    }
                }
                Thread.sleep(100);
            }

        } catch (Exception e) {
            bridge.logError("Fatal error", e);
            System.exit(1);
        } finally {
            bridge.disconnect();
        }
    }
}
