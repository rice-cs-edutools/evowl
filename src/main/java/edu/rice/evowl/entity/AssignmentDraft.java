package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

/**
 * When the constructor creates an assignment in the instructor
 * interfaces, but isn't ready to create the assignment, it is saved
 * as an AssignmentDraft.
 *
 * All of the information related to the assignment is stored as a
 * json string. This allows them to easily save the assignment as an
 * assignment draft json file, in case they want to edit it manually,
 * and then import it back into the instructor interface.
 *
 */
@Data
@ApiModel("Assignment Draft")
public class AssignmentDraft {

  @ApiModelProperty("draft id")
  private Long draft_id;

  @ApiModelProperty("draft json")
  private String json;
}
