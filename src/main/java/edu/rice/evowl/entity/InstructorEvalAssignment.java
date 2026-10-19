package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel("InstructorEvalAssignment")
public class InstructorEvalAssignment {

  @ApiModelProperty("unique id")
  private String unique_id;

  @ApiModelProperty("assignment id")
  private Long assignment_id;

  @ApiModelProperty("round")
  private byte round;

  @ApiModelProperty("idx")
  private Long idx;

  @ApiModelProperty("net id")
  private String userId;

  @ApiModelProperty("group id")
  private String group_id;

  @ApiModelProperty("criteria id")
  private Long criteria_id;

  @ApiModelProperty("grading status")
  private boolean status;
}
