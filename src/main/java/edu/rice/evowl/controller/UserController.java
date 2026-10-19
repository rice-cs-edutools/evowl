package edu.rice.evowl.controller;

import static edu.rice.evowl.util.FileUtils.getFilenames;
import static edu.rice.evowl.util.FileUtils.getSubJson;
import static edu.rice.evowl.util.JSONFormatter.*;

import edu.ksu.lti.launch.oauth.LtiPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.server.ResponseStatusException;
import edu.rice.evowl.entity.*;
import edu.rice.evowl.mapper.*;
import edu.rice.evowl.util.JSONFormatter;
import edu.rice.evowl.entity.AssignmentDraft;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Value;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.List;
import javax.annotation.Resource;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
@Api(value = "interface")
public class UserController {

  @Resource
  private SubmissionMapper submissionMapper;

  @Resource
  private PeerEvalAssignmentMapper peerEvalAssignmentMapper;

  @Resource
  private SelfEvalAssignmentMapper selfEvalAssignmentMapper;

  @Resource
  private InstructorEvalAssignmentMapper instructorEvalAssignmentMapper;

  @Resource
  private TrainingAssignmentMapper trainingAssignmentMapper;

  @Resource
  private StudentMapper studentMapper;

  @Resource
  private InstructorMapper instructorMapper;

  @Resource
  private CriteriaMapper criteriaMapper;

  @Resource
  private RubricMapper rubricMapper;

  @Resource
  private TrainingMapper trainingMapper;

  @Resource
  private DynamicPeerEvalSubmissionMapper dynamicPeerEvalSubmissionMapper;

  @Resource
  private DynamicSelfEvalSubmissionMapper dynamicSelfEvalSubmissionMapper;

  @Resource
  private InstructorEvalSubmissionMapper instructorEvalSubmissionMapper;

  @Resource
  private TrainingSubmissionMapper trainingSubmissionMapper;

  @Resource
  private AssignmentMapper assignmentMapper;

  @Resource
  private AssignmentDraftMapper assignmentDraftMapper;

  @Value("${evowl.instructor-tool.jar-path:/absolute/path/to/evowl-instructor-tool.jar}")
  private String pathToInstructorTool;

  @Value("${evowl.instructor-tool.db-name:chosen-database-name}")
  private String dbName;

  @Value("${evowl.instructor-ui.enabled}")
  private boolean enableInstructorUI;

  private static final Map<String, String> defaultConfigCache = new java.util.concurrent.ConcurrentHashMap<>();

  /**
   * HTTP endpoint for a "heartbeat"/keepalive message.
   *
   * @return a response indicating that the request has been received
   */
  @GetMapping("/heartbeat")
  public String ack() throws IOException, InterruptedException {
    return "{\"msg\": \"Success!\"}";
  }

  /**
   * HTTP endpoint for getting the default config from the instructor tool for a given language.
   * @param language The language to get the default config for.
   * @return The default config for the given language as a JSON string.
   * @throws IOException If there is an error reading the default config.
   * @throws InterruptedException If the process is interrupted.
   */
  @GetMapping("/defaultConfig")
  public String getDefaultConfig(@RequestParam String language)
    throws IOException, InterruptedException {

    if (!language.equals("golang") && !language.equals("typescript")) {
      return "{\"error\": \"Unsupported language. Valid values: golang, typescript\"}";
    }

    if (defaultConfigCache.containsKey(language)) return defaultConfigCache.get(language);

    ProcessBuilder pb = new ProcessBuilder("java", "-jar", this.pathToInstructorTool, "default-config", "--lang=" + language);
    pb.redirectErrorStream(false);
    Process p = pb.start();

    String output = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    p.waitFor();

    if (output.isBlank()) return "{\"error\": \"No default config returned for language: " + language + "\"}";
    defaultConfigCache.put(language, output);
    return output;
  }

  /**
   * HTTP endpoint for saving an assignment draft to the database.
   * @param jsonRequest The JSON request body containing the assignment draft.
   * @return A JSON response indicating success or failure.
   */
  @PostMapping("/saveDraft")
  public String saveAssignmentDraft(@RequestBody String jsonRequest) {
    try {
      assignmentDraftMapper.createTableIfNeeded();

      JSONObject body = new JSONObject(jsonRequest);
      AssignmentDraft draft = new AssignmentDraft();

      JSONObject toStore = new JSONObject(body.toString());
      toStore.remove("draftId");
      draft.setJson(toStore.toString());

      if (body.has("draftId") && !body.isNull("draftId")) {
        draft.setDraft_id(body.getLong("draftId"));
        assignmentDraftMapper.updateDraft(draft);
      } else {
        assignmentDraftMapper.insertDraft(draft);
      }

      JSONObject response = new JSONObject();
      response.put("msg", "Success!");
      response.put("draftId", draft.getDraft_id());
      return response.toString();

    } catch (Exception e) {
      JSONObject response = new JSONObject();
      response.put("special_error", e.toString());
      return response.toString();
    }
  }

  @PostMapping("/createAssignment")
  @ApiOperation("Create a new assignment in the database")
  public String createAssignment(@RequestBody String jsonRequest)
    throws IOException, InterruptedException {
    // This will have properties rosterCsv, criteriaJson, groupsJson, name, and deadline (all strings)
    JSONObject assignmentInfo = new JSONObject(jsonRequest);

    // Create the temporary files
    Path rosterFile = Files.createTempFile("roster", ".csv");
    Files.writeString(
      rosterFile,
      assignmentInfo.getString("rosterCsv"),
      StandardCharsets.UTF_8
    );
    Path groupsFile = Files.createTempFile("groups", ".json");
    Files.writeString(
      groupsFile,
      assignmentInfo.getString("groupsJson"),
      StandardCharsets.UTF_8
    );
    Path criteriaFile = Files.createTempFile("criteria", ".json");
    Files.writeString(
      criteriaFile,
      assignmentInfo.getString("criteriaJson"),
      StandardCharsets.UTF_8
    );

    String deadline = assignmentInfo.getString("deadline");
    String assignName = assignmentInfo.getString("name");
    String submissionDir = assignmentInfo.optString("submissionsDir", "");

    try {
      System.out.println("Creating roster");
      Process p1 = new ProcessBuilder(
        "java",
        "-jar",
        this.pathToInstructorTool,
        "roster",
        "--db=" + this.dbName,
        "--file=" + rosterFile.toString()
      )
        .inheritIO()
        .start();
      p1.waitFor();

      System.out.println("Creating groups");
      Process p2 = new ProcessBuilder(
        "java",
        "-jar",
        this.pathToInstructorTool,
        "groups",
        "--db=" + this.dbName,
        "--file=" + groupsFile.toString()
      )
        .inheritIO()
        .start();
      p2.waitFor();

      System.out.println("Creating assignment");
      Process p3 = new ProcessBuilder(
        "java",
        "-jar",
        this.pathToInstructorTool,
        "assignment",
        "--db=" + dbName,
        "--name=" + assignName,
        "--deadline=" + deadline,
        "--criteria=" + criteriaFile.toString(),
        "--submissions=" + submissionDir
      )
        .inheritIO()
        .start();
      p3.waitFor();
      System.out.println("Finished");
    } catch (Exception e) {
      JSONObject response = new JSONObject();
      response.put("special_error", e.toString());
      return response.toString();
    } finally {
      Files.deleteIfExists(rosterFile);
      Files.deleteIfExists(groupsFile);
      Files.deleteIfExists(criteriaFile);
    }

    return "{\"msg\": \"Success!\"}";
  }

  /**
   * Main student/TA dispatch endpoint.
   *
   * Workflow state machine:
   *   - Self-eval (before peer evals)
   *   - Training assignments (one per training module)
   *   - Peer-eval assignments (one per assigned pair)
   *   - Self-eval (after peer evals)
   *   - Done
   * All mapper calls are scoped to the current assignmentId
   */
  @GetMapping("/findByUserId/{userId}")
  @ApiOperation("Get grading infos with user id")
  public String selectSubmissionsByUserId(
    @AuthenticationPrincipal LtiPrincipal caller,
    @PathVariable(value = "userId") String userId,
    @RequestParam(value = "role", required = false) String role
  ) {
    requireUserAccess(caller, userId);
    return selectSubmissionsByUserId(userId, role);
  }

  private static void requireUserAccess(LtiPrincipal caller, String userId) {
    if (caller == null || caller.getUser() == null || caller.getUser().isBlank()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "An authenticated LTI launch is required");
    }
    if (!caller.getUser().equals(userId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "The user ID does not match the authenticated user");
    }
  }

  private String selectSubmissionsByUserId(String userId, String role) {
    Instructor instructor = instructorMapper.findByUserId(userId);
    if (enableInstructorUI) {
        if ("instructor".equalsIgnoreCase(role)) {
          return createInstructorDashboard();
        }
        if (instructor != null && "professor".equalsIgnoreCase(instructor.getRole())) {
          return createInstructorDashboard();
        }
    }

    // Check if no assignments have been created yet
    if (assignmentMapper.getAllAssignments().isEmpty()) {
      return "{\"special_error\": \"There are no active assignments. Please wait for your instructor to create an assignment.\"}";
    }

    System.out.println("userId: " + userId);
    Student student = studentMapper.findByUserId(userId);
    System.out.println("stud: " + student);
    Long assignmentId = selectActiveAssignmentId(userId, student, instructor != null);
    System.out.println("userId: " + userId);

    if (student == null && instructor == null) {
      return "{\"special_error\": \"You are not authorized to access this assignment. If you believe that this message is in error, please contact your instructor.\"}";
    }

    if (assignmentId.equals(-1L)) {
      return "{\"tag\": \"success\", \"special_error\": \"You've completed all currently available assignments!\", \"assignment_id\": \"-1\"}";
    }

    if (instructor != null) {
      // TA workflow
      System.out.println("TA WORKFLOW");
      int evalsPerCriteriaPerTa = assignmentMapper.getEvalsPerTaPerCriteria(
        Math.toIntExact(assignmentId)
      );
      System.out.println("\tevals per criteria: " + evalsPerCriteriaPerTa);
      JSONArray criteria = new JSONArray(
        instructorMapper.findCriteriaIdsByUserIdAndAssignmentId(userId, assignmentId)
      );
      System.out.println("\tcriteria for this TA: " + criteria);
      int numCriteria = criteria.length();

      List<InstructorEvalAssignment> round2Assignments =
        instructorEvalAssignmentMapper.getAllInstructorEvalAssignmentsByUserIdRound2AndAssignmentId(
          userId,
          assignmentId
        );
      InstructorEvalAssignment nextRound2Assignment =
        instructorEvalAssignmentMapper.getInstructorEvalAssignmentByUserIdRound2IncompleteAndAssignmentId(
          userId,
          assignmentId
        );
      InstructorEvalAssignment nextRound1Assignment =
        instructorEvalAssignmentMapper.getInstructorEvalAssignmentByUserIdStatusAndAssignmentId(
          userId,
          assignmentId
        );
      Long assignId = assignmentId;
      System.out.println("\tround 2 assignments: " + round2Assignments.size());
      System.out.println(
        "\tnext round 2 assignment: " +
          ((nextRound2Assignment == null)
            ? null
            : nextRound2Assignment.getUnique_id())
      );
      System.out.println(
        "\tnext round 1 assignment: " +
          ((nextRound1Assignment == null)
            ? null
            : nextRound1Assignment.getUnique_id())
      );

      if (
        round2Assignments.size() == 0 &&
        instructorEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
          userId,
          assignmentId
        ) ==
        0
      ) {
        // Just getting started -> create first instructor eval assignment
        System.out.println("\tCreating first instructor eval assignment");
        return createNewInstructorEvalAssignment(
          userId,
          0,
          assignmentId,
          criteria,
          evalsPerCriteriaPerTa
        );
      } else if (
        round2Assignments.size() != 0 && nextRound2Assignment != null
      ) {
        // Have an incomplete round 2 assignment -> send that
        System.out.println(
          "\tReturning existing (incomplete) instructor-eval assignment"
        );
        return formatInstructorEvalAssignment(
          nextRound2Assignment,
          round2Assignments.size()
        );
      } else if (
        round2Assignments.size() == 0 && nextRound1Assignment != null
      ) {
        // Have an incomplete round 1 assignment -> send that
        System.out.println(
          "\tReturning existing (incomplete) instructor-eval assignment"
        );
        return formatInstructorEvalAssignment(
          nextRound1Assignment,
          (evalsPerCriteriaPerTa * numCriteria)
        );
      } else if (
        round2Assignments.size() == 0 &&
        instructorEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
          userId,
          assignmentId
        ) >=
        (evalsPerCriteriaPerTa * numCriteria)
      ) {
        // Haven't begun round 2, but there are no round 1 assignments remaining
        System.out.println(
          "\tDone with round 1 grading, haven't begun round 2"
        );
        boolean hasNextRound1 = !selectActiveAssignmentId(userId, student, true).equals(-1L);
        return (
          "{\"special_error\": \"You've completed the first round of grading! All of your responses have been recorded.\"" +
          (hasNextRound1 ? ", \"has_next_assignment\": true" : "") +
          ", \"assignment_id\": \"" + assignId + "\"}"
        );
      } else if (
        round2Assignments.size() != 0 && nextRound2Assignment == null
      ) {
        System.out.println("Done with round 2 grading");
        boolean hasNextRound2 = !selectActiveAssignmentId(userId, student, true).equals(-1L);
        return (
          "{\"special_error\": \"You've completed the second round of grading! All of your responses have been recorded.\"" +
          (hasNextRound2 ? ", \"has_next_assignment\": true" : "") +
          ", \"assignment_id\": \"" + assignId + "\"}"
        );
      } else {
        // We're in round 1 and there is more grading to be done -> create a new instructor eval assignment
        System.out.println("\tCreating new instructor eval assignment");
        return createNewInstructorEvalAssignment(
          userId,
          instructorEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
            userId,
            assignmentId
          ),
          assignmentId,
          criteria,
          evalsPerCriteriaPerTa
        );
      }
    } else {
      //Long assignmentId = getAssignmentIdCheckDeadline(student);
      if (assignmentId.equals(-1L)) {
        return "{\"special_error\": \"The deadline for this assignment has passed. If you believe that this message is in error, please contact your instructor.\"}";
      }

      // Student workflow
      System.out.println("STUDENT WORKLOW");
      int pairsPerStudent = assignmentMapper.getPairsPerStudentById(
        Math.toIntExact(assignmentId)
      );

      // scoped to assignmentId so that a student's incomplete training from a prior assignment does not block them here
      TrainingAssignment nextIncompleteTraining =
        trainingAssignmentMapper.getTrainingAssignmentByUserIdStatusAndAssignmentId(
          userId,
          assignmentId
        );
      Map<String, Object> trainingMap = trainingMapper
        .getTrainingFormatById(assignmentId)
        .get(0);
      System.out.println("\ttraining map: " + trainingMap);
      String trainingAnswerStr = (String) trainingMap.get("answers");
      int numTrainings = new JSONArray(trainingAnswerStr).length();
      System.out.println("\tnum trainings: " + numTrainings);

      if (
        selfEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
          userId,
          assignmentId
        ) ==
        0
      ) {
        // Assign first self eval assignment
        System.out.println("\tCreating first self eval assignment");
        return createNewSelfEvalAssignment(userId, 0, assignmentId, false);
      } else if (
        selfEvalAssignmentMapper.getSelfEvalAssignmentByUserIdStatusAndAssignmentId(
          userId,
          assignmentId
        ) !=
        null
      ) {
        // Have an incomplete self eval assignment -> send that
        SelfEvalAssignment selfEvalAssignment =
          selfEvalAssignmentMapper.getSelfEvalAssignmentByUserIdStatusAndAssignmentId(
            userId,
            assignmentId
          );
        System.out.println(
          "\tReturning existing (incomplete) self-eval assignment"
        );
        // isAfter = true when there is more than 1 self-eval row (i.e. the second self-eval)
        return formatSelfEvalAssignment(
          selfEvalAssignment,
          selfEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
              userId,
              assignmentId
            ) >
            1
        );
      } else if (
        numTrainings > 0 &&
        trainingAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
          userId,
          assignmentId
        ) ==
        0
      ) {
        // Assign first training
        System.out.println("\tCreating first training");
        return createNewTrainingAssignment(
          userId,
          0,
          assignmentId,
          numTrainings
        );
      } else if (numTrainings > 0 && nextIncompleteTraining != null) {
        // Have an incomplete training --> send that
        System.out.println(nextIncompleteTraining);
        System.out.println(
          "\tReturning existing (incomplete) student training"
        );
        String uid = nextIncompleteTraining.getUnique_id();
        int nextTrainingIdx = Integer.parseInt(uid.substring(uid.lastIndexOf("-") + 1));
        System.out.println("\tindex: " + nextTrainingIdx);
        System.out.println(trainingMap);
        return formatTrainingAssignment(
          nextIncompleteTraining,
          nextTrainingIdx,
          numTrainings
        );
      } else if (
        trainingAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
          userId,
          assignmentId
        ) <
        numTrainings
      ) {
        // Have more training modules to complete!
        System.out.println("\tCreating new (subsequent) training assignments");
        return createNewTrainingAssignment(
          userId,
          trainingAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
            userId,
            assignmentId
          ),
          assignmentId,
          numTrainings
        );
      } else if (
        peerEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
          userId,
          assignmentId
        ) ==
        0
      ) {
        // Assign first peer eval assignment
        System.out.println("\tCreating first peer eval assignment");
        return createNewPeerEvalAssignment(
          userId,
          0,
          assignmentId,
          pairsPerStudent
        );
      } else if (
        peerEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
            userId,
            assignmentId
          ) !=
          0 &&
        peerEvalAssignmentMapper.getPeerEvalAssignmentByUserIdStatusAndAssignmentId(
          userId,
          assignmentId
        ) !=
        null
      ) {
        // Have an incomplete peer eval assignment -> send that
        PeerEvalAssignment peerEvalAssignment =
          peerEvalAssignmentMapper.getPeerEvalAssignmentByUserIdStatusAndAssignmentId(
            userId,
            assignmentId
          );
        System.out.println(
          "\tReturning existing (incomplete) peer-eval assignment"
        );
        return formatPeerEvalAssignment(peerEvalAssignment, pairsPerStudent);
      } else if (
        peerEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
          userId,
          assignmentId
        ) <
        pairsPerStudent
      ) {
        // Otherwise, create a new peer eval assignment
        System.out.println("\tCreating new peer eval assignment");
        return createNewPeerEvalAssignment(
          userId,
          peerEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
            userId,
            assignmentId
          ),
          assignmentId,
          pairsPerStudent
        );
      } else if (
        peerEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
            userId,
            assignmentId
          ) >=
          pairsPerStudent &&
        peerEvalAssignmentMapper.getPeerEvalAssignmentByUserIdStatusAndAssignmentId(
          userId,
          assignmentId
        ) ==
        null &&
        selfEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
          userId,
          assignmentId
        ) ==
        1
      ) {
        // Done grading -> send second self eval assignment
        System.out.println("\tCreating second self eval assignment");
        return createNewSelfEvalAssignment(userId, 1, assignmentId, true);
      } else {
        System.out.println("\tDone with the assignment");
        boolean hasNextAssignment = !selectActiveAssignmentId(userId, student, false).equals(-1L);
        return (
          "{\"tag\": \"success\", \"special_error\": \"You've completed the assignment! All of your responses have been recorded.\"" +
          (hasNextAssignment ? ", \"has_next_assignment\": true" : "") +
          ", \"assignment_id\": \"" + assignmentId + "\"}"
        );
      }
    }
  }

  @PostMapping("/saveScoreRecord")
  @ApiOperation("save score record")
  @Retryable(maxAttempts = 4, backoff = @Backoff(delay = 500), exclude = ResponseStatusException.class)
  public Object saveScoreRecord(
    @AuthenticationPrincipal LtiPrincipal caller,
    @RequestBody String jsonRequest
  ) throws ParseException {
    requireUserAccess(caller, caller != null ? caller.getUser() : null);
    System.out.println("SAVE REQUEST: ");

    // Extract timestamp
    JSONObject jsonObject = new JSONObject(jsonRequest);
    String timeStamp = jsonObject.getString("time_stamp");
    Date time = parseTimestamp(timeStamp);

    // Look up deadline
    String uniqueID = jsonObject.getString("unique_id");
    String userId = "";
    Long assignmentId = null;
    if (jsonObject.get("type").equals("self")) {
      System.out.println("\ttype = self");
      SelfEvalAssignment selfEvalAssignment = selfEvalAssignmentMapper.getSelfEvalAssignmentById(uniqueID);
      if (selfEvalAssignment == null) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found");
      }
      assignmentId = selfEvalAssignment.getAssignment_id();
      userId = selfEvalAssignment.getUserId();
    } else if (jsonObject.get("type").equals("peer")) {
      System.out.println("\ttype = peer");
      PeerEvalAssignment peerEvalAssignment = peerEvalAssignmentMapper.getPeerEvalAssignmentById(uniqueID);
      if (peerEvalAssignment == null) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found");
      }
      assignmentId = peerEvalAssignment.getAssignment_id();
      userId = peerEvalAssignment.getUserId();
    } else if (jsonObject.get("type").equals("instructor")) {
      System.out.println("\ttype = instructor");
      InstructorEvalAssignment instructorEvalAssignment = instructorEvalAssignmentMapper.getInstructorEvalAssignmentById(uniqueID);
      if (instructorEvalAssignment == null) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found");
      }
      assignmentId = instructorEvalAssignment.getAssignment_id();
      userId = instructorEvalAssignment.getUserId();
    } else if (jsonObject.get("type").equals("training")) {
      System.out.println("\ttype = training");
      System.out.println("\tuniqueid = " + uniqueID);
      TrainingAssignment trainingAssignment = trainingAssignmentMapper.getTrainingAssignmentById(uniqueID);
      if (trainingAssignment == null) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found");
      }
      assignmentId = trainingAssignment.getAssignment_id();
      userId = trainingAssignment.getUserId();
    } else {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported evaluation type");
    }

    requireUserAccess(caller, userId);
    List<Assignment> assignments = assignmentMapper.getAllAssignments();
    Date deadline = assignments.get(0).getStudent_submission_ddl();
    for (Assignment assignment : assignments) {
      if (assignment.getAssignment_id().equals(assignmentId)) {
        deadline = assignment.getStudent_submission_ddl();
      }
    }
    // Alert them to late submissions (instructors should slip through, as they are null :))
    if (
      !jsonObject.get("type").equals("instructor") &&
      deadline.compareTo(time) < 0
    ) {
      Student user = studentMapper.findByUserId(userId);
      if (
        user.getExtension() == null || user.getExtension().compareTo(time) < 0
      ) {
        System.out.println("\tDeadline has already passed!");
        return "{\"special_error\": \"The deadline for this assignment has passed. Your latest submission was made after the deadline passed, and therefore was not recorded.\"}";
      }
    }

    // Send to the appropriate save method
    if (jsonObject.get("type").equals("self")) {
      return this.saveSelfEval(jsonRequest);
    } else if (jsonObject.get("type").equals("peer")) {
      return this.savePeerEval(jsonRequest);
    } else if (jsonObject.get("type").equals("instructor")) {
      return this.saveInstructorEval(jsonRequest);
    } else {
      // type = training
      return this.saveTrainingAssignment(
        jsonRequest,
        Math.toIntExact(assignmentId)
      );
    }
  }

  /**
   * Returns true if the assignment's deadline has not yet passed, considering
   * per-student extension overrides.
   */
  private boolean isDeadlineOpen(Assignment assignment, Student student) {
    if (assignment.getStudent_submission_ddl().compareTo(new Date()) >= 0) {
      return true;
    }
    return student != null &&
      student.getExtension() != null &&
      student.getExtension().compareTo(new Date()) >= 0;
  }

  /**
   * Returns true if the student has fully completed the given assignment
   * (both self-evals submitted, with no pending incomplete self-eval).
   */
  private boolean isAssignmentCompleteForStudent(String userId, long assignmentId) {
    return selfEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(userId, assignmentId) >= 2 &&
      selfEvalAssignmentMapper.getSelfEvalAssignmentByUserIdStatusAndAssignmentId(userId, assignmentId) == null;
  }

  /**
   * Returns true if the TA has no pending work for the given assignment:
   * all round-1 grading done, and round-2 either not yet triggered or fully done.
   * Returns false if the TA has not started this assignment at all.
   */
  private boolean isAssignmentCompleteForInstructor(String userId, long assignmentId) {
    int evalsPerCriteriaPerTa = assignmentMapper.getEvalsPerTaPerCriteria(Math.toIntExact(assignmentId));
    if (instructorMapper.findByUserId(userId) == null) return true;
    int numCriteria = instructorMapper.findCriteriaIdsByUserIdAndAssignmentId(userId, assignmentId).size();
    int expectedRound = evalsPerCriteriaPerTa * numCriteria;

    int totalRows = instructorEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(userId, assignmentId);
    if (totalRows < expectedRound) return false;
    if (instructorEvalAssignmentMapper.getInstructorEvalAssignmentByUserIdStatusAndAssignmentId(userId, assignmentId) != null) {
      return false;
    }
    List<InstructorEvalAssignment> round2 =
      instructorEvalAssignmentMapper.getAllInstructorEvalAssignmentsByUserIdRound2AndAssignmentId(userId, assignmentId);
    if (round2.isEmpty()) return true;
    return instructorEvalAssignmentMapper.getInstructorEvalAssignmentByUserIdRound2IncompleteAndAssignmentId(userId, assignmentId) == null;
  }

  /**
   * Selects the active assignment for the user: the earliest-deadline open assignment
   * that they have not yet completed. Ties in deadline are broken randomly.
   * Returns -1L if no qualifying assignment exists (all done or all deadlines passed).
   */
  private Long selectActiveAssignmentId(String userId, Student student, boolean isInstructor) {
    List<Assignment> candidates = new ArrayList<>(assignmentMapper.getAllAssignments());
    System.out.println("ALL ASSIGNMENTS: " + candidates);
    candidates.removeIf(a -> !isDeadlineOpen(a, student));
    if (isInstructor) {
      candidates.removeIf(a -> isAssignmentCompleteForInstructor(userId, a.getAssignment_id()));
    } else {
      candidates.removeIf(a -> isAssignmentCompleteForStudent(userId, a.getAssignment_id()));
    }
    if (candidates.isEmpty()) return -1L;
    Collections.shuffle(candidates, new Random(userId.hashCode()));
    candidates.sort(Comparator.comparing(Assignment::getStudent_submission_ddl));
    return candidates.get(0).getAssignment_id();
  }

  private String createNewTrainingAssignment(
    String userId,
    int index,
    Long assignmentId,
    int numTrainings
  ) {
    TrainingAssignment trainingAssignment = new TrainingAssignment();
    trainingAssignment.setAssignment_id(assignmentId);
    trainingAssignment.setUnique_id(userId + "-" + assignmentId + "-" + index);
    trainingAssignment.setUserId(userId);
    System.out.println(
      "Creating new training assignment! uniqueId = " + userId + "-" + assignmentId + "-" + index
    );
    trainingAssignmentMapper.createAssignment(trainingAssignment);
    System.out.println("Success?");
    return this.formatTrainingAssignment(
      trainingAssignment,
      index,
      numTrainings
    );
  }

  private String createNewSelfEvalAssignment(
    String userId,
    int index,
    Long assignmentId,
    boolean isAfter
  ) {
    SelfEvalAssignment selfEvalAssignment = new SelfEvalAssignment();
    selfEvalAssignment.setAssignment_id(assignmentId);
    selfEvalAssignment.setUnique_id(userId + "-" + assignmentId + "-" + index);
    selfEvalAssignment.setUserId(userId);
    selfEvalAssignmentMapper.createAssignment(selfEvalAssignment);
    return this.formatSelfEvalAssignment(selfEvalAssignment, isAfter);
  }

  /**
   * Assigns the next peer eval pair for a student.
   *
   * Algorithm overview:
   *   - Collect all groups the student has already evaluated (to avoid duplicates).
   *   - Build a map from group_id to how many times each group has been assigned across all
   *       peer evals in this assignment. Groups already evaluated by this student are excluded
   *       from the map when there are enough remaining groups; otherwise they are retained to
   *       guarantee a valid pairing.
   *   - Remove the student's own group from the candidate map.
   *   - Pick the two groups with the fewest existing assignments (shuffled for randomness)
   *       as group1 and group2.
   */
  private String createNewPeerEvalAssignment(
    String userId,
    int index,
    Long assignmentId,
    int numPairs
  ) {
    // Find the group that this person belongs to for this specific assignment
    String userGroupId = studentMapper.getGroupIdByUserIdAndAssignmentId(userId, assignmentId);
    System.out.println("CREATING NEW PEER EVAL ASSIGNMENT: ");

    System.out.println("\tuserGroupId (to avoid): " + userGroupId);

    // Get the previous evaluations that this student has completed (scoped to this assignment)
    List<PeerEvalAssignment> previousAssignments =
      peerEvalAssignmentMapper.getPeerEvalAssignmentsByUserIdAndAssignmentId(
        userId,
        assignmentId
      );
    System.out.println(
      "\tprevious assignments for this evaluator: " + previousAssignments
    );

    // Get the collection of groups that have been evaluated by this student previously
    Set<String> duplicateGroups = new HashSet<>();
    for (PeerEvalAssignment pea : previousAssignments) {
      duplicateGroups.add(pea.getGroup1_id());
      duplicateGroups.add(pea.getGroup2_id());
    }
    System.out.println(
      "\tgroups that would be duplicates (to avoid): " + duplicateGroups
    );

    // Grab all submissions to this assignment and find how many times each one has been assigned
    Map<String, Integer> groupAssignmentCounts = new HashMap<>();
    List<Submission> allSubmissions =
      submissionMapper.getAllSubmissionsByAssignmentId(assignmentId);
    System.out.println(
      "\tskipping duplicate groups? " +
        (duplicateGroups.size() + 1 < allSubmissions.size())
    );
    for (Submission sub : allSubmissions) {
      // Remove duplicate groups, *if* feasible
      // +1 because we'll also remove this student's group
      if (
        duplicateGroups.size() + 1 < allSubmissions.size() &&
        duplicateGroups.contains(sub.getGroup_id())
      ) {
        continue;
      }
      groupAssignmentCounts.put(sub.getGroup_id(), 0);
    }

    List<PeerEvalAssignment> allEvalAssignments =
      peerEvalAssignmentMapper.getAllEvalAssignmentsByAssignmentId(
        assignmentId
      );
    for (PeerEvalAssignment evalAssignment : allEvalAssignments) {
      String group1 = evalAssignment.getGroup1_id();
      String group2 = evalAssignment.getGroup2_id();
      // Skip duplicates; I'd rather them grade someone who has been graded more than grade the same person twice
      if (
        duplicateGroups.size() + 1 >= allSubmissions.size() ||
        !duplicateGroups.contains(group1)
      ) {
        groupAssignmentCounts.put(
          group1,
          groupAssignmentCounts.get(group1) + 1
        );
      }
      if (
        duplicateGroups.size() + 1 >= allSubmissions.size() ||
        !duplicateGroups.contains(group2)
      ) {
        groupAssignmentCounts.put(
          group2,
          groupAssignmentCounts.get(group2) + 1
        );
      }
    }

    groupAssignmentCounts.remove(userGroupId);
    System.out.println("\tgroup assignment counts: " + groupAssignmentCounts);

    if (groupAssignmentCounts.isEmpty()) {
      System.err.println("\u001B[31mWARN: no eligible peer groups for userId=" + userId
          + " assignmentId=" + assignmentId
          + " (allSubmissions=" + allSubmissions.size()
          + ", userGroupId=" + userGroupId + ")\u001B[0m");
     
      // let it fall through, will render an error message to the user
    }

    String group1Id = null;
    String group2Id = null;

    // Filter the valid groups that have the fewest assignments
    int minAssignments = Collections.min(groupAssignmentCounts.values());
    List<String> leastAssignedGroups = new ArrayList<>();
    for (String groupId : groupAssignmentCounts.keySet()) {
      if (groupAssignmentCounts.get(groupId) == minAssignments) {
        leastAssignedGroups.add(groupId);
      }
    }

    // Choose first
    System.out.println("\tleast assigned groups: " + leastAssignedGroups);
    Collections.shuffle(leastAssignedGroups);
    group1Id = leastAssignedGroups.get(0);
    leastAssignedGroups.remove(group1Id);

    // If there was only one group with minimum assignments, find the second least
    if (leastAssignedGroups.size() == 0) {
      // Find the second minimum number of assignments
      int secondMinAssignments = groupAssignmentCounts
        .values()
        .stream()
        .filter(count -> count != minAssignments) // Exclude the minimum count
        .min(Integer::compareTo)
        .orElse(minAssignments);

      // Filter the valid groups that have the second fewest assignments
      List<String> secondLeastAssignedGroups = new ArrayList<>();
      for (Map.Entry<
        String,
        Integer
      > entry : groupAssignmentCounts.entrySet()) {
        if (entry.getValue() == secondMinAssignments) {
          secondLeastAssignedGroups.add(entry.getKey());
        }
      }

      // Shuffle the secondLeastAssignedGroups list to randomize the selection
      Collections.shuffle(secondLeastAssignedGroups);
      System.out.println(
        "\tsecond least assigned groups: " + secondLeastAssignedGroups
      );
      group2Id = secondLeastAssignedGroups.get(0);
    } else {
      group2Id = leastAssignedGroups.get(0);
    }

    if (group1Id == null || group2Id == null) {
      System.out.println("\tCould not assign a peer evaluation.");
      return "{\"error\": \"Not enough valid groups available for pairing\"}";
    }
    PeerEvalAssignment peerEvalAssignment = new PeerEvalAssignment();
    peerEvalAssignment.setAssignment_id(assignmentId);
    peerEvalAssignment.setUnique_id(userId + "-" + assignmentId + "-" + index);
    peerEvalAssignment.setUserId(userId);
    peerEvalAssignment.setPairs_per_student(numPairs);
    peerEvalAssignment.setGroup1_id(group1Id);
    peerEvalAssignment.setGroup2_id(group2Id);
    peerEvalAssignmentMapper.saveAssignmentGrouping(peerEvalAssignment);

    return formatPeerEvalAssignment(peerEvalAssignment, numPairs);
  }

  /**
   * Assigns the next instructor eval for a TA.
   *
   * The TA's assigned criteria list is divided into equal-sized windows of size
   * "evalsPerCriteriaPerTa". The window that contains "index" determines
   * which criteria_id is used for this assignment. Groups that have already been graded
   * on that criteria are excluded from the candidate pool; of the remaining groups the
   * one with the fewest total existing evaluations (across all criteria) is chosen.
   */
  private String createNewInstructorEvalAssignment(
    String userId,
    int index,
    Long assignmentId,
    JSONArray criteria,
    int evalsPerCriteriaPerTa
  ) {
    InstructorEvalAssignment instructorEvalAssignment =
      new InstructorEvalAssignment();

    // If it's created here, it must be for round 1. All assignments for round 2 will be created in the instructor tool
    instructorEvalAssignment.setRound((byte) 0);
    instructorEvalAssignment.setAssignment_id(assignmentId);
    instructorEvalAssignment.setUnique_id(userId + "-" + assignmentId + "-" + index);
    instructorEvalAssignment.setUserId(userId);
    // All round 1 assignments share the index with the index in their unique_id
    instructorEvalAssignment.setIdx((long) index);
    System.out.println("CREATING INSTRUCTOR EVAL ASSIGNMENT: ");
    System.out.println("\tta userId = " + userId);

    long criteriaId = 0;
    for (int i = 0; i < criteria.length(); i++) {
      if (index < ((i + 1) * evalsPerCriteriaPerTa)) {
        criteriaId = criteria.getLong(i);
        break;
      }
    }

    System.out.println("\tindex = " + index);
    System.out.println("\tcriteriaId = " + criteriaId);

    // Grab all submissions to this assignment and find how many times each one has been assigned to a TA
    Map<String, Set<Long>> groupAssignments = new HashMap<>();
    List<Submission> allSubmissions =
      submissionMapper.getAllSubmissionsByAssignmentId(assignmentId);
    for (Submission sub : allSubmissions) {
      groupAssignments.put(sub.getGroup_id(), new HashSet<>());
    }

    // Find out which groups have been graded for which criteria previously (scoped to assignmentId)
    List<InstructorEvalAssignment> allEvalAssignments =
      instructorEvalAssignmentMapper.getAllEvalAssignmentsByAssignmentId(
        assignmentId
      );
    System.out.println("\tallEvalAssignments: " + allEvalAssignments);
    List<String> groupsToRemove = new ArrayList<>();
    for (InstructorEvalAssignment evalAssignment : allEvalAssignments) {
      groupAssignments
        .get(evalAssignment.getGroup_id())
        .add(evalAssignment.getCriteria_id());
      if (evalAssignment.getCriteria_id() == criteriaId) {
        System.out.println(
          "\tgroup " +
            evalAssignment.getGroup_id() +
            " has already been graded on this criteria"
        );
        groupsToRemove.add(evalAssignment.getGroup_id());
      }
    }

    // Remove groups that have been graded for this criteria
    for (String groupId : groupsToRemove) {
      groupAssignments.remove(groupId);
    }

    // Find counts for remaining groups
    int minGraded = Integer.MAX_VALUE;
    List<String> leastAssignedGroups = new ArrayList<>();
    for (Map.Entry<String, Set<Long>> entry : groupAssignments.entrySet()) {
      if (entry.getValue().size() < minGraded) {
        minGraded = entry.getValue().size();
        leastAssignedGroups = new ArrayList<>();
        leastAssignedGroups.add(entry.getKey());
      }
    }

    // Choose group
    System.out.println("\tleast assigned groups: " + leastAssignedGroups);
    Collections.shuffle(leastAssignedGroups);
    if (leastAssignedGroups.isEmpty()) {
      return "{\"error\": \"Not enough valid groups available\"}";
    }
    String groupId = leastAssignedGroups.get(0);
    instructorEvalAssignment.setGroup_id(groupId);
    instructorEvalAssignment.setCriteria_id(criteriaId);
    instructorEvalAssignmentMapper.saveAssignmentGrouping(
      instructorEvalAssignment
    );
    return formatInstructorEvalAssignment(
      instructorEvalAssignment,
      (evalsPerCriteriaPerTa * criteria.length())
    );
  }

  private String formatTrainingAssignment(
    TrainingAssignment trainingAssignment,
    int idx,
    int numTrainings
  ) {
    String uniqueId = trainingAssignment.getUnique_id();
    // 0: eval_type is peer
    List<Map<String, Object>> criteriaList =
      criteriaMapper.getCriteriaFormatByAssignId(
        trainingAssignment.getAssignment_id(),
        0
      );
    List<Map<String, Object>> trainingList =
      trainingMapper.getTrainingFormatById(
        trainingAssignment.getAssignment_id()
      );

    List<List<String>> formatCriteria = buildCriteriaFormat(
      criteriaList,
      false
    );
    List<List<String>> formatTraining = new ArrayList<>();

    System.out.println("CREATING TRAINING ASSIGNMENT: ");
    System.out.println("\tidx = " + idx);
    System.out.println("\tnumTrainings = " + numTrainings);
    System.out.println("\ttrainingList: " + trainingList);
    Map<String, Object> training = trainingList.get(0);
    String trainingSub1PathsStr = training.get("submission1Paths").toString();
    String trainingSub2PathsStr = training.get("submission2Paths").toString();
    String answersStr = training.get("answers").toString();
    String feedbackStr = training.get("feedback").toString();

    System.out.println(trainingSub1PathsStr);
    JSONArray allSub1TrainingPaths = new JSONArray(trainingSub1PathsStr);
    JSONArray allSub2TrainingPaths = new JSONArray(trainingSub2PathsStr);
    JSONArray allAnswers = new JSONArray(answersStr);
    JSONArray allFeedback = new JSONArray(feedbackStr);

    String subPath1 = allSub1TrainingPaths.getString(idx);
    String subPath2 = allSub2TrainingPaths.getString(idx);
    JSONArray answers = allAnswers.getJSONArray(idx);
    JSONArray feedback = allFeedback.getJSONArray(idx);

    List<List<String>> submission1 = resolveSubmissionFiles(subPath1);
    List<List<String>> submission2 = resolveSubmissionFiles(subPath2);
    List<String> trainingInfo = new ArrayList<>();
    trainingInfo.add(submission1.toString());
    trainingInfo.add(submission2.toString());
    trainingInfo.add(answers.toString());
    trainingInfo.add(feedback.toString());
    formatTraining.add(trainingInfo);

    String jsonResult = formatTrainingData(
      formatCriteria,
      submission1,
      submission2,
      answers,
      feedback,
      idx,
      uniqueId,
      numTrainings
    );
    return jsonResult;
  }

  private String formatSelfEvalAssignment(
    SelfEvalAssignment selfEvalAssignment,
    boolean isAfter
  ) {
    String uniqueSeaId = selfEvalAssignment.getUnique_id();
    System.out.println("\tunique_id for self-eval: " + uniqueSeaId);

    List<Map<String, Object>> criteriaList =
      criteriaMapper.getCriteriaFormatByAssignId(
        selfEvalAssignment.getAssignment_id(),
        1
      );
    // skipFreeResponse=true: free-response questions are omitted from the pre-peer-eval self-eval
    List<List<String>> formatCriteria = buildCriteriaFormat(criteriaList, true);

    String jsonResult = formatSelfData(formatCriteria, uniqueSeaId, isAfter);
    return jsonResult;
  }

  private String formatPeerEvalAssignment(
    PeerEvalAssignment peerEvalAssignment,
    int numPairs
  ) {
    String uniquePeaId = peerEvalAssignment.getUnique_id();
    System.out.println("\tunique_id for peer eval: " + uniquePeaId);
    // Count is scoped to assignmentId so the progress index is correct for the current assignment
    int curIndex = peerEvalAssignmentMapper.getTotalRowsByUserIdAndAssignmentId(
      peerEvalAssignment.getUserId(),
      peerEvalAssignment.getAssignment_id()
    );
    List<Map<String, Object>> criteriaList =
      criteriaMapper.getCriteriaFormatByAssignId(
        peerEvalAssignment.getAssignment_id(),
        0
      );
    List<List<String>> formatCriteria = buildCriteriaFormat(
      criteriaList,
      false
    );

    List<List<String>> submission1 = resolveSubmissionFiles(
      peerEvalAssignment.getAssignment_id(),
      peerEvalAssignment.getGroup1_id()
    );
    List<List<String>> submission2 = resolveSubmissionFiles(
      peerEvalAssignment.getAssignment_id(),
      peerEvalAssignment.getGroup2_id()
    );

    String jsonResult = formatPeerData(
      formatCriteria,
      submission1,
      submission2,
      uniquePeaId,
      numPairs,
      curIndex
    );
    return jsonResult;
  }

  private String formatInstructorEvalAssignment(
    InstructorEvalAssignment instructorEvalAssignment,
    int totalEvals
  ) {
    String uniqueIeaId = instructorEvalAssignment.getUnique_id();
    System.out.println("\tunique_id for instructor eval: " + uniqueIeaId);

    int curIndex = Math.toIntExact(instructorEvalAssignment.getIdx());

    // Just get a single criterion (though it will be in a list)
    Map<String, Object> criteriaMap =
      criteriaMapper.getCriteriaFormatByCriteriaId(
        instructorEvalAssignment.getAssignment_id(),
        instructorEvalAssignment.getCriteria_id(),
        2
      );
    List<List<String>> formatCriteria = new ArrayList<>();
    List<String> criteriaInfo = new ArrayList<>();
    criteriaInfo.add(
      criteriaMap.get("criteriaText").toString().replace("\"", "")
    );
    criteriaInfo.add(criteriaMap.get("maxChar").toString());
    formatCriteria.add(criteriaInfo);

    List<Map<String, Object>> rubricList = rubricMapper.getRubricFormatById(
      instructorEvalAssignment.getAssignment_id(),
      instructorEvalAssignment.getCriteria_id()
    );
    List<List<String>> formatRubric = new ArrayList<>();

    for (Map<String, Object> rubricMap : rubricList) {
      List<String> rubricInfo = new ArrayList<>();
      rubricInfo.add(rubricMap.get("headers").toString());
      rubricInfo.add(rubricMap.get("deductionText").toString());
      rubricInfo.add(rubricMap.get("deductionPts").toString());
      rubricInfo.add(rubricMap.get("mutuallyExclusive").toString());
      formatRubric.add(rubricInfo);
    }
    System.out.println("format rubric: " + formatRubric);
    List<List<String>> submission = resolveSubmissionFiles(
      instructorEvalAssignment.getAssignment_id(),
      instructorEvalAssignment.getGroup_id()
    );

    return formatInstructorData(
      formatCriteria,
      formatRubric,
      submission,
      uniqueIeaId,
      totalEvals,
      curIndex + 1,
      instructorEvalAssignment.getRound()
    );
  }

  private String saveSelfEval(String jsonRequest) throws ParseException {
    // Extract (key, value) pairs
    JSONObject jsonObject = new JSONObject(jsonRequest);
    String uniqueID = jsonObject.getString("unique_id");
    JSONArray mcAnswers = jsonObject.getJSONArray("choices");
    List<Integer> mcAnswersInt = new ArrayList<>();
    for (Object answer : mcAnswers) {
      String strAns = (String) answer;
      mcAnswersInt.add(Integer.parseInt(strAns));
    }
    JSONArray frAnswers = jsonObject.getJSONArray("free_responses");
    System.out.println("SAVING SELF EVAL");
    SelfEvalAssignment selfEvalAssignment =
      selfEvalAssignmentMapper.getSelfEvalAssignmentById(uniqueID);
    String userId = selfEvalAssignment.getUserId();
    Long assignID = selfEvalAssignment.getAssignment_id();
    String submissionID = assignID + "-" + uniqueID;

    // Extract timestamp
    String timeStamp = jsonObject.getString("time_stamp");
    Date time = parseTimestamp(timeStamp);

    // Extract free response answers
    Map<Integer, String> frMap = new HashMap<>();
    if (frAnswers.length() != 0) {
      frMap = extractFreeResponsesSelf(assignID, frAnswers);
    } else {
      int numFR = criteriaMapper.getNumSelfFRQuestions(assignID);
      if (numFR > 0) {
        // If free sresponse for self-eval is ever added, update this with getting the values
        int baseIdx = criteriaMapper.findSmallestCriteriaIdWithFreeResponse(
          assignID,
          1
        );
        for (int i = baseIdx; i < baseIdx + numFR; i++) {
          frMap.put(i, "");
        }
      }
    }

    DynamicSelfEvalSubmission dynamicSelfEvalSubmission =
      new DynamicSelfEvalSubmission();
    dynamicSelfEvalSubmission.setSubmission_id(submissionID);
    dynamicSelfEvalSubmission.setUnique_id(uniqueID);
    dynamicSelfEvalSubmission.setSubmit_time(time);
    dynamicSelfEvalSubmission.setChoices(mcAnswersInt.toString());
    System.out.println("\tchoices: " + mcAnswersInt.toString());
    dynamicSelfEvalSubmission.setFree_responses(
      JSONFormatter.objectToJson(frMap).toString()
    );

    // Insert the record into the table
    dynamicSelfEvalSubmissionMapper.saveDynamicScoreRecord(
      dynamicSelfEvalSubmission
    );
    selfEvalAssignmentMapper.updateAssignmentStatus(uniqueID, true);

    // If this save completed the current assignment, return the done message directly so the
    // student sees it before being routed to the next assignment (which selectActiveAssignmentId
    // would otherwise pick immediately, skipping the done screen entirely).
    if (isAssignmentCompleteForStudent(userId, assignID)) {
      Student doneStudent = studentMapper.findByUserId(userId);
      boolean hasNext = !selectActiveAssignmentId(userId, doneStudent, false).equals(-1L);
      return "{\"tag\": \"success\", \"special_error\": \"You've completed the assignment! All of your responses have been recorded.\"" +
        (hasNext ? ", \"has_next_assignment\": true" : "") +
        ", \"assignment_id\": \"" + assignID + "\"}";
    }

    return selectSubmissionsByUserId(userId, null);
  }

  private String savePeerEval(String jsonRequest) throws ParseException {
    DynamicPeerEvalSubmission dynamicPeerEvalSubmission =
      new DynamicPeerEvalSubmission();
    List<Object> parsedResult = parsePeerEval(jsonRequest);
    String uniqueId = (String) parsedResult.get(0);
    System.out.println("SAVING PEER EVAL");

    // get submission 1 and 2
    PeerEvalAssignment peerEvalAssignment =
      peerEvalAssignmentMapper.getPeerEvalAssignmentById(uniqueId);
    String sub1 = peerEvalAssignment.getGroup1_id();
    String sub2 = peerEvalAssignment.getGroup2_id();
    Long assignId = peerEvalAssignment.getAssignment_id();
    sub1 = assignId + "-" + sub1;
    sub2 = assignId + "-" + sub2;

    // get userId of student
    String userId = peerEvalAssignment.getUserId();

    // get date
    Date timeStamp = parseTimestamp((String) parsedResult.get(2));

    // get free responses
    String[] freeResponses = (String[]) parsedResult.get(3);
    Map<Integer, Map<Integer, String>> fr = new HashMap<>();
    if (freeResponses.length != 0) {
      fr = extractFreeResponsesPeer(assignId, freeResponses);
    }

    dynamicPeerEvalSubmission.setSubmission_id1(sub1);
    dynamicPeerEvalSubmission.setSubmission_id2(sub2);
    dynamicPeerEvalSubmission.setUnique_id(uniqueId);
    dynamicPeerEvalSubmission.setSubmit_time(timeStamp);
    System.out.println("\tchoices: " + parsedResult.get(1).toString());
    dynamicPeerEvalSubmission.setChoices((String) parsedResult.get(1));
    dynamicPeerEvalSubmission.setFree_responses(
      JSONFormatter.objectToJson(fr).toString()
    );

    // Insert the record into the table
    dynamicPeerEvalSubmissionMapper.saveDynamicScoreRecord(
      dynamicPeerEvalSubmission
    );
    peerEvalAssignmentMapper.updateAssignmentStatus(uniqueId, true);
    System.out.println("[SAVE-PEER] Status after update for uniqueId=" + uniqueId + ": " +
      (peerEvalAssignmentMapper.getPeerEvalAssignmentById(uniqueId) != null
        ? peerEvalAssignmentMapper.getPeerEvalAssignmentById(uniqueId).isStatus()
        : "row not found"));

    return selectSubmissionsByUserId(userId, null);
  }

  private String saveInstructorEval(String jsonRequest) throws ParseException {
    InstructorEvalSubmission instructorEvalSubmission =
      new InstructorEvalSubmission();
    List<Object> parsedResult = parseInstructorEval(jsonRequest);
    String uniqueId = (String) parsedResult.get(0);

    // get submission 1
    InstructorEvalAssignment instructorEvalAssignment =
      instructorEvalAssignmentMapper.getInstructorEvalAssignmentById(uniqueId);
    String sub1 = instructorEvalAssignment.getGroup_id();
    Long assignId = instructorEvalAssignment.getAssignment_id();
    sub1 = assignId + "-" + sub1;
    System.out.println("SAVING INSTRUCTOR EVAL");

    // get userId of instructor
    String userId = instructorEvalAssignment.getUserId();

    // get date
    Date timeStamp = parseTimestamp((String) parsedResult.get(3));

    instructorEvalSubmission.setSubmission_id(sub1);
    instructorEvalSubmission.setDeductions((String) parsedResult.get(2));
    instructorEvalSubmission.setUnique_id(uniqueId);
    instructorEvalSubmission.setSubmit_time(timeStamp);
    System.out.println("\tchoices: " + parsedResult.get(1).toString());
    instructorEvalSubmission.setChoices((String) parsedResult.get(1));
    System.out.println("\tfreeresponse: " + parsedResult.get(4).toString());
    instructorEvalSubmission.setFree_responses(parsedResult.get(4).toString());

    // Insert the record into the table
    instructorEvalSubmissionMapper.saveDynamicScoreRecord(
      instructorEvalSubmission
    );

    // Update status
    instructorEvalAssignmentMapper.updateAssignmentStatus(uniqueId, true);

    // If this save brought the TA's work on this assignment to be completed, return the
    // appropriate done message so the TA sees it before the selector advances them to the
    // next assignment.
    if (isAssignmentCompleteForInstructor(userId, assignId)) {
      List<InstructorEvalAssignment> round2Rows =
        instructorEvalAssignmentMapper.getAllInstructorEvalAssignmentsByUserIdRound2AndAssignmentId(userId, assignId);
      boolean hasNext = !selectActiveAssignmentId(userId, null, true).equals(-1L);
      String msg = round2Rows.isEmpty()
        ? "You've completed the first round of grading! All of your responses have been recorded."
        : "You've completed the second round of grading! All of your responses have been recorded.";
      return "{\"special_error\": \"" + msg + "\"" +
        (hasNext ? ", \"has_next_assignment\": true" : "") +
        ", \"assignment_id\": \"" + assignId + "\"}";
    }

    return selectSubmissionsByUserId(userId, null);
  }

  private String saveTrainingAssignment(String jsonRequest, int assignmentId)
    throws ParseException {
    TrainingSubmission trainingSubmission = new TrainingSubmission();
    List<Object> parsedResult = parsePeerEval(jsonRequest);

    System.out.println(jsonRequest);
    System.out.println(parsedResult);
    String uniqueId = parsedResult.get(0).toString();
    String userId = trainingAssignmentMapper
      .getTrainingAssignmentById(uniqueId)
      .getUserId();
    System.out.println("SAVING TRAINING");
    System.out.println("\tuniqueid: " + uniqueId);
    System.out.println("\tuserId: " + userId);

    // get date
    Date timeStamp = parseTimestamp((String) parsedResult.get(2));
    System.out.println("\ttimestamp: " + timeStamp);

    trainingSubmission.setAssign_id(assignmentId);
    trainingSubmission.setUnique_id(uniqueId);
    trainingSubmission.setSubmit_time(timeStamp);
    trainingSubmission.setSubmission_id(userId);
    System.out.println("\tchoices: " + parsedResult.get(1).toString());
    trainingSubmission.setChoices(parsedResult.get(1).toString());

    // get free responses
    String[] freeResponses = (String[]) parsedResult.get(3);
    System.out.println("\tfreeResponses: " + Arrays.toString(freeResponses));
    Map<Integer, Map<Integer, String>> fr = new HashMap<>();
    if (freeResponses.length != 0) {
      fr = extractFreeResponsesPeer((long) assignmentId, freeResponses);
    }
    trainingSubmission.setFree_responses(
      JSONFormatter.objectToJson(fr).toString()
    );

    trainingSubmissionMapper.saveDynamicScoreRecord(trainingSubmission);
    trainingAssignmentMapper.updateAssignmentStatus(uniqueId, true);

    return selectSubmissionsByUserId(userId, null);
  }

  private Map<Integer, Map<Integer, String>> extractFreeResponsesPeer(
    Long assignId,
    String[] freeResponses
  ) {
    Map<Integer, Map<Integer, String>> fr = new HashMap<>();
    int criteria = criteriaMapper.findSmallestCriteriaIdWithFreeResponse(
      assignId,
      0
    );
    int i;
    for (i = 0; i < freeResponses.length - 2; i += 2) {
      Map<Integer, String> s = new HashMap<>();
      s.put(1, freeResponses[i]);
      s.put(2, freeResponses[i + 1]);
      fr.put(criteria, s);
      criteria = criteria + 1;
    }
    Map<Integer, String> s = new HashMap<>();
    s.put(1, freeResponses[i]);
    s.put(2, freeResponses[i + 1]);
    fr.put(-999, s); // using -999 for metrics (special case)
    return fr;
  }

  private Map<Integer, String> extractFreeResponsesSelf(
    Long assignId,
    JSONArray freeResponses
  ) {
    Map<Integer, String> fr = new HashMap<>();
    int criteria = criteriaMapper.findSmallestCriteriaIdWithFreeResponse(
      assignId,
      1
    );
    for (int i = 0; i < freeResponses.length(); i++) {
      fr.put(i + criteria, (String) freeResponses.get(i));
    }
    return fr;
  }

  private Map<String, Integer> groupIdToIndex() {
    List<String> groupIds = submissionMapper.getAllGroupIds();
    Map<String, Integer> mapping = new HashMap<>();
    for (int i = 0; i < groupIds.size(); i++) {
      mapping.put(groupIds.get(i), i);
    }
    return mapping;
  }

  /**
   * Parse a timestamp string using the standard "yyyy-MM-dd HH:mm:ss" format.
   */
  private Date parseTimestamp(String timeStamp) throws ParseException {
    SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
    formatter.setTimeZone(TimeZone.getDefault());
    return formatter.parse(timeStamp);
  }

  /**
   * Build the formatted criteria list from a raw mapper result.
   *
   * @param criteriaList     rows from criteriaMapper
   * @param skipFreeResponse when true, free-response rows are excluded (used for pre-peer self-eval)
   */
  private List<List<String>> buildCriteriaFormat(
    List<Map<String, Object>> criteriaList,
    boolean skipFreeResponse
  ) {
    List<List<String>> formatCriteria = new ArrayList<>();
    for (Map<String, Object> criteriaMap : criteriaList) {
      if (
        skipFreeResponse &&
        criteriaMap.get("isFreeResponse").toString().equals("1")
      ) {
        continue;
      }
      List<String> criteriaInfo = new ArrayList<>();
      criteriaInfo.add(criteriaMap.get("criteriaText").toString());
      criteriaInfo.add(criteriaMap.get("isFreeResponse").toString());
      criteriaInfo.add(criteriaMap.get("maxChar").toString());
      formatCriteria.add(criteriaInfo);
    }
    return formatCriteria;
  }

  /**
   * Look up the submission files for a given (assignmentId, groupId) pair.
   * Builds the composite submission ID, resolves the path, and returns the file contents.
   */
  private List<List<String>> resolveSubmissionFiles(
    Long assignmentId,
    String groupId
  ) {
    String submissionId = assignmentId + "-" + groupId;
    String subPath = submissionMapper.getSubmissionPathBySubmission(
      submissionMapper.getSubmissionById(submissionId)
    );
    Set<String> relativeFiles = getFilenames(subPath);
    return getSubJson(relativeFiles, subPath);
  }

  /**
   * Overload of resolveSubmissionFiles for training assignments.
   */
  private List<List<String>> resolveSubmissionFiles(String subPath) {
    Set<String> relativeFiles = getFilenames(subPath);
    return getSubJson(relativeFiles, subPath);
  }

  private String createInstructorDashboard() {
    JSONArray draftsJson = new JSONArray();
    try {
      for (AssignmentDraft draft : assignmentDraftMapper.getAllAssignmentDrafts()) {
        JSONObject draftJson = new JSONObject(draft.getJson());
        draftJson.put("draftId", draft.getDraft_id());
        draftsJson.put(draftJson);
      }
    } catch (Exception e) {}

    JSONArray assignmentsJson = new JSONArray();
    // This will fail if the database has not been set up yet, which it might not have been
    try {
      for (Assignment assignment : assignmentMapper.getAllAssignments()) {
        JSONObject assignmentJson = new JSONObject();
        Long assnId = assignment.getAssignment_id();
        assignmentJson.put("id", assnId);
        assignmentJson.put("name", assignment.getAssignment_name().toString());
        assignmentJson.put(
          "deadline",
          assignment.getStudent_submission_ddl().toString()
        );
        assignmentJson.put(
          "peerEvalCount",
          assignmentMapper.getPairsPerStudentById(assnId.intValue())
        );

        // Add the criteria names
        List<Map<String, Object>> assignmentCriteria =
          criteriaMapper.getAllCriteriaFormatByAssignId(
            assignment.getAssignment_id()
          );
        assignmentJson.put(
          "criteria",
          JSONFormatter.objectToJson(assignmentCriteria)
        );

        // Add the peer evals
        JSONArray peerEvalsJson = new JSONArray();
        List<DynamicPeerEvalSubmission> peerEvals =
          dynamicPeerEvalSubmissionMapper.getAllByAssignmentId(
            assignment.getAssignment_id()
          );
        for (DynamicPeerEvalSubmission peerEval : peerEvals) {
          JSONObject peerEvalJson = new JSONObject();
          peerEvalJson.put("uniqueId", peerEval.getUnique_id());
          peerEvalJson.put("submitTime", peerEval.getSubmit_time().toString());
          peerEvalJson.put("choices", peerEval.getChoices());
          peerEvalJson.put("freeResponses", peerEval.getFree_responses());
          PeerEvalAssignment assign =
            peerEvalAssignmentMapper.getPeerEvalAssignmentById(
              peerEval.getUnique_id()
            );
          peerEvalJson.put("group1", assign.getGroup1_id());
          peerEvalJson.put("group2", assign.getGroup2_id());
          peerEvalsJson.put(peerEvalJson);
        }
        assignmentJson.put("peerEvals", peerEvalsJson);

        // Add the self evals
        JSONArray selfEvalsJson = new JSONArray();
        List<DynamicSelfEvalSubmission> selfEvals =
          dynamicSelfEvalSubmissionMapper.getAllByAssignmentId(
            assignment.getAssignment_id()
          );
        for (DynamicSelfEvalSubmission selfEval : selfEvals) {
          JSONObject selfEvalJson = new JSONObject();
          selfEvalJson.put("uniqueId", selfEval.getUnique_id());
          selfEvalJson.put("submitTime", selfEval.getSubmit_time().toString());
          selfEvalJson.put("choices", selfEval.getChoices());
          selfEvalJson.put("freeResponses", selfEval.getFree_responses());
          selfEvalsJson.put(selfEvalJson);
        }
        assignmentJson.put("selfEvals", selfEvalsJson);

        // Add the students
        JSONArray studentsJson = new JSONArray();
        for (Student student : studentMapper.getAllStudents()) {
          JSONObject studentJson = new JSONObject();
          studentJson.put("userId", student.getUserId());
          studentJson.put("name", student.getUser_name());
          studentJson.put("group", student.getGroup_id());
          studentsJson.put(studentJson);
        }
        assignmentJson.put("students", studentsJson);

        assignmentsJson.put(assignmentJson);
      }
    } catch (Exception e) {}

    JSONObject dashboardInfo = new JSONObject();
    dashboardInfo.put("drafts", draftsJson);
    dashboardInfo.put("assignments", assignmentsJson);
    dashboardInfo.put("type", "instructor_dashboard");
    return dashboardInfo.toString();
  }
}
